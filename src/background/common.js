const $ = require('jquery');
const qu = require('async/queue');
const co = require('co');
const moment = require('moment');
const _ = require('lodash');

const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const cache = require('../common/data-cache.js')();
const serviceUrl = `https://${constants.hostname}`;

const alarmPeriodMinutes = 12 * 60;
const alarmKey = 'macheteSync';
const entityIdKey = 'spEntityIds';
const lastVersionKey = 'lastVersion';

chrome.runtime.onInstalled.addListener(details => {
    const manifest = chrome.runtime.getManifest();
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/${process.env.PRODUCT}/welcome` });
    }
    localStorage.setItem(lastVersionKey, manifest.version);
    setAlarm();
});

chrome.pageAction.onClicked.addListener(ga.mcatch(() => {
    chrome.tabs.create({ url: `${serviceUrl}/profile` });
}));

function messageListener(handler) {
    chrome.runtime.onMessage.addListener(ga.mcatch((req, sender, sendResponse) => {
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

        chrome.pageAction.show(sender.tab.id);
        ga.mga('event', 'background-message', req.action);
        const begin = performance.now();

        co(handler(req, sender))
        .then(data => {
            const response = { data };
            console.log('Success handling message:', req, "response", response);
            sendResponse(response);
        })
        .catch(error => {
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
        })
        .then(() => {
            const end = performance.now();
            ga.mga('timing', 'Background Task', req.action, Math.round(end - begin));
        });

        return true;
    }));
}

function* getUser() {
    return yield ajax(`${serviceUrl}/api/user`, {
        method: 'GET',
        dataType: 'json'
    });
}

function startSession(req) {
    return co(dataGather(req));
}

function* dataGather(req) {
    console.log('Data sync start at', moment().format());
    const lastSync = JSON.parse(localStorage.getItem('lastSync')) || {};

    /* These requires MUST go here to avoid a circular require */
    const kdp = require('./kdp.js'); // eslint-disable-line global-require
    const seller = require('./seller.js'); // eslint-disable-line global-require
    const sp = require('./sp.js'); // eslint-disable-line global-require

    if (req.entityId) {
        addEntityId(req.entityId);
    }
    
    const oldSync = Math.max(..._.values(lastSync));
    let newSync = 0;
    for (const mod of [sp, seller, kdp]) {
        if (!mod.name) {
            console.error('looking at nameless module', mod);
            throw new Error('module has no name');
        }

        if (lastSync[mod.name]) {
            const moduleSync = moment(lastSync[mod.name]);
            console.log('Last data sync for', mod.name, 'at', moduleSync.format());
            if (moment().isSame(moduleSync, 'day')) {
                console.log(mod.name, 'sync is up-to-date');
                continue;
            }
        }
        else {
            console.log('No recorded sync for', mod.name);
        }

        try {
            console.log('Data sync', mod.name, 'start at', moment().format());
            yield* mod.dataGather();
            newSync = Date.now();
            lastSync[mod.name] = newSync;
        }
        catch (ex) {
            if (!handleServerErrors(ex, 'dataGather:'+mod.name))
                ga.mex(ex);
        }
        console.log('Data sync', mod.name, 'finish at', moment().format());
    }

    cache.clear();
    localStorage.setItem('lastSync', JSON.stringify(lastSync));

    console.log('Data sync finish at', moment().format());
    return Math.max(newSync, oldSync);
}

function addEntityId(entityId) {
    const ids = JSON.parse(localStorage.getItem(entityIdKey)) || [];
    if (!ids.includes(entityId)) {
        ids.push(entityId);
        localStorage.setItem(entityIdKey, JSON.stringify(ids));
    }
}

function getEntityIds() {
    const entityIds = JSON.parse(localStorage.getItem(entityIdKey)) || [];

    // TODO: eventually delete this once all users have been updated
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.match(/^campaignData_/)) {
            toDelete.push(key);

            const entityId = key.replace('campaignData_', '');
            if (entityId) {
                entityIds.push(entityId);
            }
        }
    }
    for (const key of toDelete) {
        localStorage.removeItem(key);
    }

    return entityIds;
}

function setAlarm() {
    chrome.alarms.onAlarm.addListener(ga.mcatch(alarm => {
        if (alarm.name == alarmKey) {
            co(dataGather()).catch(ga.mex);
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
    if (ex.message.match(/^404/)) {
        ga.mga('event', 'error-handled', 'network-error-404', desc);
        return 'notFound';
    }
    if (ex.message.match(/^50/)) {
        ga.mga('event', 'error-handled', 'server-error', desc);
        return 'serverError';
    }
    if (ex.message.match(/0 error/)) {
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

function ajax(...args) {
    const err = new Error(); // capture more informative stack trace here

    return new Promise((resolve, reject) => {
        $.ajax(...args)
        .done(resolve)
        .fail(function (errorXhr) {
            err.method = this.method; // eslint-disable-line no-invalid-this
            err.url = this.url; // eslint-disable-line no-invalid-this
            err.message = `${errorXhr.status} ${errorXhr.statusText}`;
            reject(err);
        });
    });
}

function parallelQueue(items, fn) {
    return new Promise((resolve, reject) => {
        const queue = qu((item, callback) => {
            co(fn(item))
            .then((...results) => callback(null, ...results))
            .catch(callback);
        }, 3);

        queue.drain = resolve;
        queue.error = reject;
        queue.push(items);
    });
}

module.exports = {
    serviceUrl,
    messageListener,
    getUser: cache.coMemo(getUser, { maxAge: 2 * constants.timespan.minute }),
    handleServerErrors,
    ajax,
    parallelQueue,
    cache,
    startSession,
    addEntityId,
    getEntityIds,
};
