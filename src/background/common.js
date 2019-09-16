const ga = require('../common/ga.js');
const qu = require('async/queue');
const sleep = require('sleep-promise').default;

const serviceUrl = `https://${process.env.HOSTNAME}`;

chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/setup/postinstall` });
    }
});

chrome.pageAction.onClicked.addListener(ga.mcatch(() => {
    chrome.tabs.create({ url: `${serviceUrl}/dashboard` });
}));

function handlePortConnect(messageHandler) {
    return port => {
        if (port.name == 'machete.action') {
            port.onMessage.addListener(req => {
                messageHandler(req, port, res => port.postMessage(Object.assign(res, { msgId: req.msgId })));
            });
        }
        if (port.name == 'machete.log') {
            const listener = {
                log(msg) {
                    port.postMessage(msg);
                }
            };
            ga.addLogListener(listener);
            port.onDisconnect.addListener(() => {
                ga.removeLogListener(listener);
            });
        }
    };
}

function messageListener(handler) {
    const messageHandler = createMessageHandler(handler);

    chrome.runtime.onMessage.addListener(messageHandler);
    chrome.runtime.onMessageExternal.addListener(messageHandler);
    chrome.runtime.onConnect.addListener(handlePortConnect(messageHandler));
    chrome.runtime.onConnectExternal.addListener(handlePortConnect(messageHandler));
}

function createMessageHandler(handler) {
    return ga.mcatch((req, sender, sendResponse) => {
        ga.debug('Handling message:', req);
        if (sender.tab && sender.tab.incognito) {
            sendResponse({ 
                error: {
                    handled: 'incognito',
                    message: 'Machete cannot be used in incognito mode',
                }
            });
            return true;
        }

        async function f() {
            if (sender.tab)
                chrome.pageAction.show(sender.tab.id);

            ga.mevent('background-message', req.action);
            try {
                let data = await handler(req, sender);
                if (typeof data == 'undefined')
                    data = ''; // must return a defined falsy value!

                const response = { data };
                ga.debug('Success handling message:', req, "response", response);
                sendResponse(response);
            }
            catch (error) {
                if (handlePortDisconnected(error, req.action))
                    return;
                if (handleMessageTooLong(error, req.action))
                    return;

                const response = { status: error.message, error: ga.errorToObject(error) };
                const handled = handleServerErrors(error, req.action);
                if (handled) {
                    response.error.handled = handled;
                    ga.warn(error);
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
        }
        f();

        return true;
    });
}

function sayHello() {
    const manifest = chrome.runtime.getManifest();
    return { 
        ok: true,
        version: manifest.version,
    };
}

function handleServerErrors(ex, desc) {
    if (ex.url && ex.url.match(/machete-app.com/)) {
        if (ex.message.match(/^401/)) {
            ga.mevent('error-handled', 'auth-error-401', desc);
            return 'notLoggedIn';
        }
        if (ex.message.match(/^402/)) {
            ga.mevent('error-handled', 'auth-error-402', desc);
            return 'notAllowed';
        }
        if (ex.message.match(/^403/)) {
            ga.mevent('error-handled', 'auth-error-403', desc);
            return 'notOwned';
        }
    }
    if (ex.message.match(/^401/)) {
        ga.mevent('error-handled', 'network-error-401', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^403/)) {
        ga.mevent('error-handled', 'network-error-403', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^404/)) {
        ga.mevent('error-handled', 'network-error-404', desc);
        return 'notFound';
    }
    if (ex.message.match(/^50/)) {
        ga.mevent('error-handled', 'server-error', desc);
        return 'serverError';
    }
    if (ex.message.match(/0 error/) || ex.message.match(/Failed to fetch/)) {
        ga.mevent('error-handled', 'network-error-unknown', desc);
        return 'amazonNotLoggedIn';
    }
    return null;
}

function handlePortDisconnected(ex, desc) {
    if (ex.message.match(/disconnected port object/)) {
        ga.mevent('error-handled', 'port-disconnected', desc);
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
    while (true) { // eslint-disable-line no-constant-condition
        try {
            const response = await window.fetch(url, init);
            if (!response.ok) {
                if (await shouldRetry(response)) {
                    await sleep(5000);
                    continue;
                }

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
}

async function shouldRetry(response) {
    if (response.status == 429) { // 429 Too Many Requests
        return true;
    }
    if (response.status == 403) { // 403 Access too frequently!
        const text = await response.text();
        return text.toLowerCase().includes("frequently");
    }
    return false;
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

function* pageArray(array, step) {
    if (!array || !array.length)
        return;
    for (let index = 0; index < array.length; index += step) {
        yield array.slice(index, index + step);
    }
}

module.exports = {
    ajax,
    handleServerErrors,
    messageListener,
    pageArray,
    parallelQueue,
    sayHello,
};
