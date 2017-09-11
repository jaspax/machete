const $ = require('jquery');
const co = require('co');

const constants = require('../common/constants.js');

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

function messageListener(handler) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        console.log('Handling message:', req);
        co(handler(req, sender))
        .then(data => {
            const response = { data };
            console.log('Success handling message:', req, "response", response);
            sendResponse(response);
        })
        .catch(error => {
            let response = null;
            if (typeof error.status == 'undefined' && error.statusText)
                response = { status: error.status, error: error.statusText };
            else
                response = { status: error.message, error };
            console.log('Error handling message:', req, 'response', response);
            sendResponse(response);
        });

        return true;
    });
}

function* getUser() {
    return yield $.ajax(`${serviceUrl}/api/user`, { 
        method: 'GET',
        dataType: 'json' 
    });
}

module.exports = {
    serviceUrl,
    messageListener,
    getUser,
};
