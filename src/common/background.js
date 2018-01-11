const $ = require('jquery');
const co = require('co');
const memoize = require('memoizee');

const constants = require('../common/constants.js');
const ga = require('../common/ga.js');

const lastVersionKey = 'lastVersion';
const serviceUrl = `https://${constants.hostname}`;

chrome.runtime.onInstalled.addListener(details => {
    const manifest = chrome.runtime.getManifest();
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/${process.env.PRODUCT}/welcome` });
    }
    else if (details.reason == 'update') {
        const lastVersion = localStorage.getItem(lastVersionKey);
        const currentVersion = manifest.version;

        // the following comparison implicitly ignores the C in A.B.C, due to
        // the way that parseFloat works
        if (!lastVersion || parseFloat(currentVersion) > parseFloat(lastVersion)) {
            chrome.tabs.create({ url: chrome.runtime.getURL(`html/changelog.html`) });
        }
    }
    localStorage.setItem(lastVersionKey, manifest.version);
});

chrome.pageAction.onClicked.addListener(ga.mcatch(() => {
    chrome.tabs.create({ url: `${serviceUrl}/profile` });
}));

const memoOptsDefault = {
    promise: true,
    length: false,
    primitive: true,
    maxAge: 6 * constants.timespan.hour,
};
function coMemo(fn, opts = {}) {
    return memoize((...args) => co(fn(...args)), 
                   Object.assign({}, memoOptsDefault, opts));
}

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

function handleServerErrors(ex, desc) {
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
    if (ex.message.match(/^50/)) {
        ga.mga('event', 'error-handled', 'server-error', desc);
        return 'serverError';
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

module.exports = {
    serviceUrl,
    messageListener,
    getUser: coMemo(getUser, { maxAge: 2 * constants.timespan.minute }),
    handleServerErrors,
    ajax,
    coMemo,
};
