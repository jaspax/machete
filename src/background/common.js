const ga = require('../common/ga.js');
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
                    handled: 'incognito',
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
                let data = await handler(req, sender);
                if (typeof data == 'undefined')
                    data = ''; // must return a defined falsy value!

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
                const handled = handleServerErrors(error, req.action);
                if (handled) {
                    response.error.handled = handled;
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
        return 'amazonNotLoggedIn';
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

let lastSuccessfulEntityId = '';

async function ajax(url, opts) {
    const init = {
        method: opts.method,
        headers: new Headers(),
        mode: 'cors',
        credentials: 'include',
    };

    const queryData = opts.queryData || {};
    const q = new URLSearchParams();
    for (const key of Object.keys(queryData)) {
        q.append(key, queryData[key]);
    }
    url += '?' + q.toString();

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
    let retrySec = 1;
    while (true) { // eslint-disable-line no-constant-condition
        try {
            const response = await window.fetch(url, init);
            if (!response.ok) {
                if (retrySec < 60 && shouldRetry(response, queryData.entityId, lastSuccessfulEntityId)) {
                    await sleep(retrySec * 1000);
                    retrySec *= 2;
                    continue;
                }

                let errorStr = `${response.status} ${response.statusText}`;
                try {
                    const body = await response.text();
                    if (body) {
                        errorStr += `: ${body.substr(0, 100)}`;
                    }
                }
                catch (ex) {
                    console.error(ex);
                }
                throw new Error(errorStr);
            }
            if (response.redirected) {
                // this is USUALLY because we got redirected to a login page. In
                // this case we fake a 401 so that calling code handles it
                // correctly.
                url += ` (redirected to ${response.url})`;
                throw new Error('401 Redirect');
            }

            if (queryData.entityId) {
                lastSuccessfulEntityId = queryData.entityId;
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

// These statuses are known to correspond to transient error conditions that
// often succeed on retry. Yes, including the 404.
const retryStatuses = [403, 404, 429, 502];

function shouldRetry(response, currentEntityId, successfulEntityId) {
    return retryStatuses.contains(Number(response.status)) && currentEntityId === successfulEntityId;
}

module.exports = {
    ajax,
    handleServerErrors,
    messageListener,
    sayHello,
};
