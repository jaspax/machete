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

chrome.pageAction.onClicked.addListener(() => {
    chrome.tabs.create({ url: `${serviceUrl}/profile` });
});

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
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        console.log('Handling message:', req);
        chrome.pageAction.show(sender.tab.id); // Do this for all actions

        ga.mga('event', 'background-message', req.action);
        const begin = performance.now();

        co(handler(req, sender))
        .then(data => {
            const response = { data };
            console.log('Success handling message:', req, "response", response);
            sendResponse(response);
        })
        .catch(error => {
            const response = { status: error.message, error: ga.errorToObject(error) };
            if (handleAuthErrors(error, req.action)) {
                response.error.handled = true;
                response.error.authError = true;
                console.warn(error);
            }
            else {
                ga.merror(req, error);
            }
            sendResponse(response);
        })
        .then(() => {
            const end = performance.now();
            ga.mga('timing', 'Background Task', req.action, Math.round(end - begin));
        });

        return true;
    });
}

function* getUser() {
    return yield ajax(`${serviceUrl}/api/user`, {
        method: 'GET',
        dataType: 'json'
    });
}

function handleAuthErrors(ex, desc) {
    if (ex.message.match(/^401/)) {
        ex.notLoggedIn = true;
        ga.mga('event', 'error-handled', 'auth-error-401', desc);
        return true;
    }
    if (ex.message.match(/^403/)) {
        ex.notAllowed = true;
        ga.mga('event', 'error-handled', 'auth-error-403', desc);
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
    handleAuthErrors,
    ajax,
    coMemo,
};
