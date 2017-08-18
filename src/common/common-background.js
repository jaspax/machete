const $ = require('jquery');
const co = require('co');

const constants = require('../common/constants.gen.js');

const lastVersionKey = 'machete-last-version';
const serviceUrl = `https://${constants.hostname}`;

chrome.runtime.onInstalled.addListener(details => {
    const manifest = chrome.runtime.getManifest();
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/plugin/welcome` });
    }
    else if (details.reason == 'update') {
        const lastVersion = localStorage.getItem(lastVersionKey);
        const currentVersion = manifest.version;

        // the following comparison implicitly ignores the C in A.B.C, due to
        // the way that parseFloat works
        if (!lastVersion || parseFloat(currentVersion) > parseFloat(lastVersion)) {
            chrome.tabs.create({ url: chrome.runtime.getURL('html/changelog.html') });
        }
    }
    localStorage.setItem(lastVersionKey, manifest.version);
});

function messageListener(handler) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        console.log('Handling message:', req);
        co(handler(req, sender))
        .then(data => {
            console.log('Success handling message:', req);
            sendResponse({ data });
        })
        .catch(error => {
            console.log('Error handling message:', req, 'error:', error);
            sendResponse({ status: error.status, error });
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
