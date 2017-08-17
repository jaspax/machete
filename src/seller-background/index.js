const $ = require('jquery');
const co = require('co');
const constants = require('../common/constants.gen.js');

const lastUpdateKey = 'machete-last-update';
const lastVersionKey = 'machete-last-version';
const dataAlarmName = 'machete-data-alarm';
const serviceUrl = `https://${constants.hostname}`;

const alarmPeriodMinutes = 240;

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

chrome.alarms.onAlarm.addListener(() => {
    co(function*() { 
        yield* alarmHandler();
    });
});

function* alarmHandler() {
    console.log('Alarm handler start at', new Date());

    try {
        // This will throw if we can't get through, effectively calling the whole
        // thing off.
        yield* requestCampaignData();

        /*
        const adGroups = yield* getAdGroups();
        for (const item of adGroups) {
            try {
                yield* requestKeywordData(item.adGroupId);
            }
            catch (ex) {
                ga.mex(ex);
            }
        }
        */
    }
    finally {
        console.log('Alarm handler finish at', new Date());
    }
}

function* setSession() {
    console.log('seller session startup');
    
    // Always request data on login, then set the alarm
    let lastCampaignData = parseFloat(localStorage.getItem(lastUpdateKey));
    if (!lastCampaignData || 
        isNaN(lastCampaignData) || 
        Date.now() - lastCampaignData >= constants.timespan.minute * alarmPeriodMinutes) {
            yield* alarmHandler();
    }

    yield new Promise(resolve => {
        chrome.alarms.get(dataAlarmName, alarm => {
            if (!alarm) {
                chrome.alarms.create(dataAlarmName, {
                    when: Date.now() + 500,
                    periodInMinutes: alarmPeriodMinutes,
                });
                console.log('set alarm for', dataAlarmName);
                resolve(true);
            }
            resolve(false);
        });
    });
}

function* requestCampaignData() {
    // let timestamp = Date.now(); // WILL BE NEEDED LATER
    let data = null;
    try {
        console.log('requesting campaign data');
        data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/campaign/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: 0,
                iDisplayLength: 50,
                statisticsPeriod: 'MONTH_TO_DATE',
                aggregates: false,
                statusFilter: 'ENABLED'
                /* TODO: figure out how to use these maybe
                status: null,
                startDate: null,
                endDate: null,
                */
            },
            dataType: 'json',
        });
    }
    catch (ex) {
        /* TURN THIS BACK ON SHORTLY
        if (ex.status == 401) { // Unauthorized
            notifyNeedCredentials();
        } */
        throw ex;
    }

    console.log('got campaign data', data);

    /*
    if (data && data.aaData && data.aaData.length) {
        let campaignIds = data.aaData.map(x => x.campaignId);
        yield* requestCampaignStatus(campaignIds, timestamp);
    }

    yield* storeDataCloud(timestamp, data);
    localStorage.setItem(getCampaignDataKey(), timestamp);
    */

    return data;
}

