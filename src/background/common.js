const qu = require('async/queue');
const moment = require('moment');
const _ = require('lodash');

const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const cache = require('../common/data-cache.js')();
const serviceUrl = `https://${constants.hostname}`;

const alarmPeriodMinutes = 12 * 60;
const alarmKey = 'macheteSync';
const entityIdKey = 'spEntityIds';
const sellerDomainKey = 'sellerDomains';
const lastVersionKey = 'lastVersion';

chrome.runtime.onInstalled.addListener(details => {
    const manifest = chrome.runtime.getManifest();
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/setup/postinstall` });
    }
    localStorage.setItem(lastVersionKey, manifest.version);
    setAlarm();
});

chrome.pageAction.onClicked.addListener(ga.mcatch(() => {
    chrome.tabs.create({ url: `${serviceUrl}/dashboard` });
}));

function messageListener(handler) {
    chrome.runtime.onMessage.addListener(messageHandler(handler));
    chrome.runtime.onMessageExternal.addListener(messageHandler(handler));
}

function messageHandler(handler) {
    return ga.mcatch((req, sender, sendResponse) => {
        console.log('Handling message:', req);
        if (sender.tab.incognito) {
            sendResponse({ 
                error: {
                    handled: true,
                    authError: 'incognito',
                    message: 'Machete cannot be used in incognito mode',
                }
            });
            return true;
        }

        async function f() {
            chrome.pageAction.show(sender.tab.id);
            ga.mga('event', 'background-message', req.action);
            const begin = performance.now();

            try {
                const data = await handler(req, sender);
                const response = { data };
                console.log('Success handling message:', req, "response", response);
                sendResponse(response);
            }
            catch (error) {
                if (handlePortDisconnected(error, req.action))
                    return;
                if (handleMessageTooLong(error, req.action))
                    return;

                const response = { status: error.message, error: ga.errorToObject(error) };
                const authError = handleServerErrors(error, req.action);
                if (authError) {
                    response.error.handled = true;
                    response.error.authError = authError;
                    console.warn(error);
                }
                else {
                    ga.merror(req, error);
                }

                try {
                    sendResponse(response);
                }
                catch (ex) {
                    handlePortDisconnected(ex, req.action);
                }
            }

            const end = performance.now();
            ga.mga('timing', 'Background Task', req.action, Math.round(end - begin));
        }
        f();

        return true;
    });
}

function getUser() {
    return ajax(`${serviceUrl}/api/user`, {
        method: 'GET',
        responseType: 'json'
    });
}

function startSession(req) {
    return dataGather(req);
}

function sayHello() {
    return { 'ok': true };
}

const lastSync = JSON.parse(localStorage.getItem('lastSync')) || {};
function hasSyncedToday(module) {
    if (lastSync[module]) {
        const moduleSync = moment(lastSync[module]);
        console.log('Last data sync for', module, 'at', moduleSync.format());
        return moment().isSame(moduleSync, 'day');
    }

    console.log('No recorded sync for', module);
    return false;
}

function setSyncTime(module, time) {
    lastSync[module] = time;
    localStorage.setItem('lastSync', JSON.stringify(lastSync));
}

const dataGather = cache.coMemo(async function(req) {
    console.log('Data sync start at', moment().format());

    // Store entityIds and domains for further use
    if (req.entityId) {
        setEntityId(req.entityId, { domain: req.domain });
    }
    else if (req.domain) {
        addSellerDomain(req.domain);
    }
    
    /* These requires MUST go here to avoid a circular require */
    const kdp = require('./kdp.js'); // eslint-disable-line global-require
    const sp = require('./sp.js'); // eslint-disable-line global-require

    const oldSync = Math.max(..._.values(lastSync));
    let newSync = 0;
    for (const mod of [sp, kdp]) {
        if (!mod.name) {
            console.error('looking at nameless module', mod);
            throw new Error('module has no name');
        }

        if (hasSyncedToday(mod.name))
            continue;

        try {
            console.log('Data sync', mod.name, 'start at', moment().format());
            await mod.dataGather(req);
            newSync = Date.now();
            setSyncTime(mod.name, newSync);
        }
        catch (ex) {
            if (!handleServerErrors(ex, 'dataGather:'+mod.name))
                ga.merror(ex);
        }
        console.log('Data sync', mod.name, 'finish at', moment().format());
    }

    cache.clear();

    console.log('Data sync finish at', moment().format());
    return Math.max(newSync, oldSync);
}, { maxAge: 6 * constants.timespan.hour });

function setEntityId(entityId, fields) {
    if (isUnset(entityId)) {
        throw new Error('Invalid arguments to setEntityId:' + JSON.stringify({ entityId, fields }));
    }

    const ids = JSON.parse(localStorage.getItem(entityIdKey)) || [];
    let existing = ids.find(x => x.entityId == entityId);
    if (existing) {
        Object.assign(existing, fields);
    }
    else {
        existing = Object.assign({ entityId }, fields);
        ids.push(existing);
    }
    localStorage.setItem(entityIdKey, JSON.stringify(ids));
    return existing;
}

function isUnset(str) {
    return !str || str == 'undefined' || str == 'null';
}

function getEntityIds() {
    const entityIds = JSON.parse(localStorage.getItem(entityIdKey)) || [];

    // Fix up entityIds to ensure that every one has a stored domain
    let ids = entityIds.map(item => {
        if (typeof item == 'string') {
            return { domain: 'advertising.amazon.com', entityId: item };
        }
        else if (!item.domain) {
            item.domain = 'advertising.amazon.com';
        }
        return item;
    });

    ids = _.uniqBy(ids, 'entityId').filter(x => !isUnset(x.domain) && !isUnset(x.entityId));
    ids.forEach(x => x.domain = x.domain.replace(/^ams\./, 'advertising.'));
    localStorage.setItem(entityIdKey, JSON.stringify(ids));

    return ids;
}

function addSellerDomain(domain) {
    if (!domain) {
        ga.merror("bad arguments to addSellerDomain:", JSON.stringify(domain));
        return;
    }

    const ids = JSON.parse(localStorage.getItem(sellerDomainKey)) || [];
    if (!ids.includes(domain)) {
        ids.push(domain);
        localStorage.setItem(sellerDomainKey, JSON.stringify(ids));
    }
}

function getSellerDomains() {
    return JSON.parse(localStorage.getItem(sellerDomainKey)) || [];
}

function setAlarm() {
    chrome.alarms.onAlarm.addListener(ga.mcatch(alarm => {
        if (alarm.name == alarmKey) {
            dataGather({}).catch(ga.merror);
        }
    }));
    return ga.mpromise(resolve => {
        chrome.alarms.get(alarmKey, alarm => {
            if (!alarm) {
                const when = Date.now() + 1000;
                chrome.alarms.create(alarmKey, {
                    when,
                    periodInMinutes: alarmPeriodMinutes,
                });
                console.log('set alarm ', alarmKey, 'for', moment(when).format());
                resolve(true);
            }
            resolve(false);
        });
    });
}

function handleServerErrors(ex, desc) {
    if (ex.url && ex.url.match(/machete-app.com/)) {
        if (ex.message.match(/^401/)) {
            ga.mga('event', 'error-handled', 'auth-error-401', desc);
            return 'notLoggedIn';
        }
        if (ex.message.match(/^402/)) {
            ga.mga('event', 'error-handled', 'auth-error-402', desc);
            return 'notAllowed';
        }
        if (ex.message.match(/^403/)) {
            ga.mga('event', 'error-handled', 'auth-error-403', desc);
            return 'notOwned';
        }
    }
    if (ex.message.match(/^401/)) {
        ga.mga('event', 'error-handled', 'network-error-401', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^403/)) {
        ga.mga('event', 'error-handled', 'network-error-403', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^404/)) {
        ga.mga('event', 'error-handled', 'network-error-404', desc);
        return 'notFound';
    }
    if (ex.message.match(/^50/)) {
        ga.mga('event', 'error-handled', 'server-error', desc);
        return 'serverError';
    }
    if (ex.message.match(/0 error/) || ex.message.match(/Failed to fetch/)) {
        ga.mga('event', 'error-handled', 'network-error-unknown', desc);
        return 'networkError';
    }
    return null;
}

function handlePortDisconnected(ex, desc) {
    if (ex.message.match(/disconnected port object/)) {
        ga.mga('event', 'error-handled', 'port-disconnected', desc);
        return true;
    }
    return false;
}

function handleMessageTooLong(ex, req) {
    if (ex.message.match(/exceeded maximum allowed length/)) {
        ga.merror(ex.message, req);
        return true;
    }
    return false;
}

async function ajax(url, opts) {
    const init = {
        method: opts.method,
        headers: new Headers(),
        mode: 'cors',
        credentials: 'include',
    };

    if (opts.queryData) {
        const q = new URLSearchParams();
        for (const key of Object.keys(opts.queryData)) {
            q.append(key, opts.queryData[key]);
        }
        url += '?' + q.toString();
    }

    if (opts.formData && opts.jsonData)
        throw new Error('Cannot set both formData and jsonData on ajax request');

    if (opts.formData) {
        init.body = new URLSearchParams();
        for (const key of Object.keys(opts.formData)) {
            init.body.append(key, opts.formData[key]);
        }
        init.headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
    else if (opts.jsonData) {
        init.body = JSON.stringify(opts.jsonData);
        init.headers.set('Content-Type', 'application/json');
    }

    const origStack = new Error().stack;
    try {
        const response = await window.fetch(url, init);
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
        if (response.redirected) {
            // this is USUALLY because we got redirected to a login page. In
            // this case we fake out a 401 so that calling code handles it
            // correctly.
            url += ` (redirected to ${response.url})`;
            throw new Error('401 Redirect');
        }

        if (response.status == 204)
            return null;

        const body = await response.text();
        if (opts.responseType == 'json') {
            if (!body.length)
                return {};
            return JSON.parse(body);
        }
        return body;
    }
    catch (ex) {
        ex.method = opts.method;
        ex.url = url;
        ex.origStack = origStack;
        throw ex;
    }
}

function parallelQueue(items, fn) {
    return new Promise((resolve, reject) => {
        const results = [];
        let error = null;
        const queue = qu((item, callback) => {
            fn(item).then(value => {
                results.push(value);
                callback(null, value);
            })
            .catch(ex => {
                ga.merror(ex);
                error = ex;
                callback();
            });
        }, 3);

        queue.drain = () => {
            if (error)
                reject(error);
            else
                resolve(results);
        };
        queue.error = reject; // shouldn't happen since we're swallowing errors until drain
        queue.push(Array.from(items));
    });
}

module.exports = {
    serviceUrl,
    messageListener,
    getUser: cache.coMemo(getUser, { maxAge: 2 * constants.timespan.minute }),
    sayHello,
    handleServerErrors,
    ajax,
    parallelQueue,
    cache,
    startSession,
    isUnset,
    setEntityId,
    getEntityIds,
    addSellerDomain,
    getSellerDomains,
    hasSyncedToday,
    setSyncTime,
};
