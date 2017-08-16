const $ = require('jquery');
const co = require('co');
const ga = require('../common/ga.js');
const constants = require('../common/constants.gen.js');

const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
const serviceUrl = `https://${constants.hostname}`;

const alarmPeriodMinutes = 240;

function checkEntityId(entityId) {
    if (!(entityId && entityId != 'undefined' && entityId != 'null')) {
        throw new Error(`invalid entityId={${entityId}}`);
    }
}

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

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    console.log('Handling message:', req);
    co(function*() {
        if (req.action == 'setSession')
            return yield* setSession(req);
        else if (req.action == 'getUser')
            return yield* getUser();
        else if (req.action == 'getAllowedCampaigns') 
            return yield* getAllowedCampaigns(req.entityId);
        else if (req.action == 'requestData')
            return yield* requestCampaignData(req.entityId);
        else if (req.action == 'getDataHistory')
            return yield* getDataHistory(req.entityId, req.campaignId);
        else if (req.action == 'requestKeywordData')
            return yield* requestKeywordData(req.entityId, req.adGroupId);
        else if (req.action == 'getKeywordData')
            return yield* getKeywordData(req.entityId, req.adGroupId);
        else if (req.action == 'setCampaignMetadata')
            return yield* setCampaignMetadata(req.entityId, req.campaignId, req.asin);
        else if (req.action == 'setAdGroupMetadata')
            return yield* setAdGroupMetadata(req.entityId, req.adGroupId, req.campaignId);
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

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    try {
        checkEntityId(entityId);
    }
    catch (ex) {
        chrome.alarms.clear(session.name, cleared => console.log("cleared useless alarm", cleared));
        return;
    }

    co(function*() { 
        yield* alarmHandler(entityId);
    });
});

function* alarmHandler(entityId) {
    console.log('Alarm handler start at', new Date());

    // This will throw if we can't get through, effectively calling the whole
    // thing off.
    yield* requestCampaignData(entityId);

    const adGroups = yield* getAdGroups(entityId);
    for (const item of adGroups) {
        try {
            yield* requestKeywordData(entityId, item.adGroupId);
        }
        catch (ex) {
            ga.mex(ex);
        }
    }
    console.log('Alarm handler finish at', new Date());
}

function* setSession(req) {
    console.log('page session startup for', req);
    let sessionKey = getSessionKey(req.entityId);
    
    // Always request data on login, then set the alarm
    let lastCampaignData = localStorage.getItem(getCampaignDataKey(req.entityId));
    if (!lastCampaignData || Date.now() - lastCampaignData >= constants.timespan.minute * alarmPeriodMinutes) {
        yield* alarmHandler(req.entityId);
    }

    yield new Promise(resolve => {
        chrome.alarms.get(sessionKey, alarm => {
            if (!alarm) {
                chrome.alarms.create(sessionKey, {
                    when: Date.now() + 500,
                    periodInMinutes: alarmPeriodMinutes,
                });
                console.log('set alarm for', sessionKey);
                resolve(true);
            }
            resolve(false);
        });
    });
}

function* getUser() {
    return yield $.ajax(`${serviceUrl}/api/user`, { 
        method: 'GET',
        dataType: 'json' 
    });
}

function* getAllowedCampaigns(entityId) {
    checkEntityId(entityId);

    try {
        return yield $.ajax(`${serviceUrl}/api/data/${entityId}/allowed`, { 
            method: 'GET',
            dataType: 'json'
        });
    }
    catch (ex) {
        if (ex.status == 401) {
            // this is basically expected, so don't propagate it as an error
            ga.mga('event', 'error-handled', 'entityid-unauthorized');
            return yield [];
        }
        throw ex;
    }
}

function* requestCampaignData(entityId) {
    checkEntityId(entityId);

    let timestamp = Date.now();
    let data = null;
    try {
        console.log('requesting campaign data for', entityId);
        data = yield $.ajax('https://ams.amazon.com/api/rta/campaigns', {
            method: 'GET',
            data: {
                entityId,
                /* TODO: use these once Amazon actually supports them
                status: null,
                startDate: null,
                endDate: null,
                */
            },
            dataType: 'json',
        });
    }
    catch (ex) {
        if (ex.status == 401) { // Unauthorized
            notifyNeedCredentials(entityId);
        }
        throw ex;
    }

    if (data && data.aaData && data.aaData.length) {
        let campaignIds = data.aaData.map(x => x.campaignId);
        yield* requestCampaignStatus(entityId, campaignIds, timestamp);
    }

    yield* storeDataCloud(entityId, timestamp, data);
    localStorage.setItem(getCampaignDataKey(entityId), timestamp);

    return data;
}

function* requestCampaignStatus(entityId, campaignIds, timestamp) {
    checkEntityId(entityId); 

    const data = yield $.ajax('https://ams.amazon.com/api/rta/campaign-status', {
        method: 'GET',
        data: { 
            entityId, 
            campaignIds: campaignIds.join(','),
        },
        dataType: 'json',
    });

    yield* storeStatusCloud(entityId, timestamp, data);
    return data;
}

function* requestKeywordData(entityId, adGroupId) {
    checkEntityId(entityId);

    let timestamp = Date.now();
    console.log('requesting keyword data for', entityId, adGroupId);
    const data = yield $.ajax('https://ams.amazon.com/api/sponsored-products/getAdGroupKeywordList', {
        method: 'POST',
        data: {
            entityId, adGroupId,
            /* TODO: use these once Amazon actually supports them
            status: null,
            startDate: null,
            endDate: null,
            */
        },
        dataType: 'json',
    });

    if (data.message) {
        throw new Error(data.message);
    }

    yield* storeKeywordDataCloud(entityId, adGroupId, timestamp, data);
    return data;
}

function* storeDataCloud(entityId, timestamp, data) {
    return yield $.ajax(`${serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeStatusCloud(entityId, timestamp, data) {
    return yield $.ajax(`${serviceUrl}/api/campaignStatus/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
    return yield $.ajax(`${serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* getDataHistory(entityId, campaignId) { // TODO: date ranges, etc.
    checkEntityId(entityId);
    return yield $.ajax(`${serviceUrl}/api/data/${entityId}/${campaignId}`, { 
        method: 'GET',
        dataType: 'json'
    });
}

function* getKeywordData(entityId, adGroupId) {
    checkEntityId(entityId);
    return yield $.ajax(`${serviceUrl}/api/keywordData/${entityId}/${adGroupId}`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* setCampaignMetadata(entityId, campaignId, asin) {
    checkEntityId(entityId);
    return yield $.ajax(`${serviceUrl}/api/campaignMetadata/${entityId}/${campaignId}`, {
        method: 'PUT',
        data: JSON.stringify({ asin }),
        contentType: 'application/json',
    });
}

function* setAdGroupMetadata(entityId, adGroupId, campaignId) {
    checkEntityId(entityId);
    return yield $.ajax(`${serviceUrl}/api/adGroupMetadata/${entityId}/${adGroupId}`, {
        method: 'PUT',
        data: JSON.stringify({ campaignId }),
        contentType: 'application/json',
    });
}

function* getAdGroups(entityId) {
    checkEntityId(entityId);
    return yield $.ajax(`${serviceUrl}/api/adGroups/${entityId}`, {
        method: 'GET',
        dataType: 'json',
    });
}

let notificationExists = false;
function notifyNeedCredentials(entityId) {
    if (!notificationExists) {
        let notificationId = `machete-${entityId}-need-credentials`;
        chrome.notifications.create(notificationId, {
            type: "basic",
            iconUrl: "images/machete-128.png",
            title: "Sign in to AMS",
            message: "Machete needs you to sign in to AMS so it can keep your campaign history up-to-date.",
            contextMessage: "Click to sign in at https://ams.amazon.com/",
            isClickable: true,
            requireInteraction: true,
        });

        notificationExists = true;
        ga.mga('event', 'credential-popup', 'show');
        chrome.notifications.onClicked.addListener((clickId) => {
            if (clickId == notificationId) {
                ga.mga('event', 'credential-popup', 'click');
                chrome.tabs.create({ url: "https://ams.amazon.com/ads/dashboard" });
                chrome.notifications.clear(notificationId);
                notificationExists = false;
            }
        });
        chrome.notifications.onClosed.addListener(() => {
            notificationExists = false;
            ga.mga('event', 'credential-popup', 'dismiss');
        });
    }
}
