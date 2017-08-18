const $ = require('jquery');
const co = require('co');
const constants = require('../common/constants.gen.js');

const lastUpdateKey = 'machete-last-update';
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
            chrome.tabs.create({ url: chrome.runtime.getURL('html/seller-changelog.html') });
        }
    }
    localStorage.setItem(lastVersionKey, manifest.version);
});


chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    console.log('Handling message:', req);
    co(function*() {
        if (req.action == 'setSession')
            return yield* setSession(req);
        throw new Error('unknown action');
    })
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

function* synchronizeCampaignData() {
    console.log('synchronizeCampaignData start at', new Date());

    try {
        const ranges = yield* getMissingRanges();

        for (const range of ranges) {
            yield* requestCampaignDataRange(range.start, range.end);
        }
    }
    finally {
        console.log('synchronizeCampaignData finish at', new Date());
    }
}

function* setSession() {
    yield* synchronizeCampaignData();
}

function* requestCampaignDataRange(startDate, endDate) {
    let data = null;
    try {
        console.log('requesting campaign data in range', startDate, endDate);
        const pageSize = 50;
        let currentPage = 0;
        let totalRecords = 0;
        do {
            data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/campaign/fetch', {
                method: 'GET',
                data: {
                    sEcho: 1,
                    parentCreationDate: 0,
                    iDisplayStart: currentPage,
                    iDisplayLength: pageSize,
                    statisticsPeriod: 'CUSTOMIZED',
                    startDate,
                    endDate,
                    aggregates: false,
                    statusFilter: 'ENABLED'
                },
                dataType: 'json',
            });

            totalRecords = data.iTotalRecords;
            currentPage++;

            yield* storeCampaignDataRange(data, startDate, endDate);
        }
        while (currentPage * pageSize < totalRecords);
    }
    catch (ex) {
        /* TURN THIS BACK ON SHORTLY
        if (ex.status == 401) { // Unauthorized
            notifyNeedCredentials();
        } */
        throw ex;
    }

    return data;
}

function* getMissingRanges() {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/missingRanges`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* storeCampaignDataRange(data, startDate, endDate) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/${startDate}-${endDate}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}
