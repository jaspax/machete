const constants = require('../common/constants.gen.js');

const serviceUrl = `https://${constants.hostname}`;

chrome.runtime.onInstalled.addListener(details => {
    const manifest = chrome.runtime.getManifest();
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/plugin/welcome` });
    }
    else if (details.reason == 'update') {
        const lastVersion = localStorage.getItem('lastVersion');
        const currentVersion = manifest.version;

        // the following comparison implicitly ignores the C in A.B.C, due to
        // the way that parseFloat works
        if (!lastVersion || parseFloat(currentVersion) > parseFloat(lastVersion)) {
            chrome.tabs.create({ url: chrome.runtime.getURL('html/changelog.html') });
        }
    }
    localStorage.setItem('lastVersion', manifest.version);
});

function* getUser() {
    return yield $.ajax(`${bg.serviceUrl}/api/user`, { 
        method: 'GET',
        dataType: 'json' 
    });
}
