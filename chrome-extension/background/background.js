const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
const serviceUrl = 'https://machete-app.com';
const sid = () => localStorage.getItem('sid');

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}


// Put this in root b/c we want it EVERY time this is invoked, even if the user
// blows away local storage for some reason
if (!sid()) {
    localStorage.setItem('sid', guid());
}

chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('common/welcome.html') });
    }
    else if (details.reason == 'update') {
        chrome.tabs.create({ url: chrome.runtime.getURL('common/changelog.html') });
    }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action == 'setSession')
        setSession(req, sendResponse);
    else if (req.action == 'requestData')
        requestCampaignData(req.entityId, sendResponse);
    else if (req.action == 'getDataHistory')
        getDataHistory(req.entityId, req.campaignId, sendResponse);
    else if (req.action == 'requestKeywordData')
        requestKeywordData(req.entityId, req.adGroupId, sendResponse);
    else if (req.action == 'getKeywordData')
        getKeywordData(req.entityId, req.adGroupId, sendResponse);
    else if (req.action == 'getSid')
        sendResponse();
    else 
        sendResponse('unknown action');
    return true;
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    let timestamp = Date.now();
    requestCampaignData(entityId, (data) => {
        data.error ? console.warn('request data', data.error)
                   : console.log('request data success');
    });
});

function setSession(req, sendResponse) {
    let sessionKey = getSessionKey(req.entityId);
    localStorage.setItem(sessionKey, req.cookies);
    console.log('stored cookies', sessionKey, req.cookies);
    
    // Always request data on login, then set the alarm
    let lastCampaignData = localStorage.getItem(getCampaignDataKey(req.entityId));
    if (!lastCampaignData || Date.now() - lastCampaignData >= span.hour) {
        requestCampaignData(req.entityId, () => console.log("stored campaign data"));
    }
    chrome.alarms.get(sessionKey, (alarm) => {
        if (!alarm) {
            let period = 60;
            chrome.alarms.create(sessionKey, {
                when: Date.now() + 500,
                periodInMinutes: 60,
            });
            console.log('set alarm for', sessionKey);
        }
    });
    sendResponse('ok');

    /* TODO: this way of posting the session into the cloud doesn't actually
     * work, alas
    let sessionEndpoint = `${serviceUrl}/session/${req.entityId}`;
    console.log("making request to", sessionEndpoint);
    $.ajax(sessionEndpoint, {
        method: 'PUT',
        data: req.cookies,
        contentType: 'text/plain',
        success: (data, textStatus, xhr) => {
            console.log(textStatus, ": ", data);
        },
        error: (xhr, textStatus, error) => {
            console.warn(textStatus, ": ", error);
        },
    });
    */

}

function requestCampaignData(entityId, sendResponse) {
    let sessionKey = getSessionKey(entityId);
    let timestamp = Date.now();
    console.log('requesting campaign data for', entityId);
    $.ajax('https://ams.amazon.com/api/rta/campaigns', {
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
        success: (data, textStatus, xhr) => {
            storeDataCloud(entityId, timestamp, data)
                .then(() => sendResponse({data}))
                .fail((error) => sendResponse({error}));
        },
        error: (xhr, textStatus, error) => {
            if (xhr.status == 401) // Unauthorized
                notifyNeedCredentials(entityId);
            sendResponse({error});
        },
    });

    localStorage.setItem(getCampaignDataKey(entityId), timestamp);
}

function requestKeywordData(entityId, adGroupId, sendResponse) {
    let sessionKey = getSessionKey(entityId);
    let timestamp = Date.now();
    console.log('requesting keyword data for', entityId, adGroupId);
    $.ajax('https://ams.amazon.com/api/sponsored-products/getAdGroupKeywordList', {
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
        success: (data, textStatus, xhr) => {
            storeKeywordDataCloud(entityId, adGroupId, timestamp, data)
                .then(() => sendResponse({data}))
                .fail((error) => sendResponse({error}));
        },
        error: (xhr, textStatus, error) => sendResponse({error}),
    });
}

function storeDataCloud(entityId, timestamp, data) {
    return $.ajax({
        url: `${serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('cloud storage', status), 
        error: (xhr, status, error) => console.warn('cloud storage', status, error),
    });
}

function storeKeywordDataCloud(entityId, adGroupId, timestamp, data, cb) {
    return $.ajax({
        url: `${serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('keyword storage', status), 
        error: (xhr, status, error) => console.warn('keyword storage', status, error),
    });
}

function getDataHistory(entityId, campaignId, sendResponse) { // TODO: date ranges, etc.
    $.ajax({
        url: `${serviceUrl}/api/data/${entityId}/${campaignId}`,
        method: 'GET',
        dataType: 'json',
        success: (data, status) => {
            sendResponse({data});
        },
        error: (xhr, status, error) => {
            sendResponse({error, status});
        },
    });
}

function getKeywordData(entityId, adGroupId, sendResponse) {
    $.ajax({
        url: `${serviceUrl}/api/keywordData/${entityId}/${adGroupId}`,
        method: 'GET',
        dataType: 'json',
        success: (data, status) => {
            sendResponse({data});
        },
        error: (xhr, status, error) => {
            sendResponse({error, status});
        },
    });
}

function notifyNeedCredentials(entityId) {
    let notificationId = `${prefix}-${entityId}-need-credentials`;
    chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "images/machete-128.png",
        title: "Sign in to AMS",
        message: "Machete needs you to sign in to AMS so it can keep your campaign history up-to-date.",
        contextMessage: "Click to sign in at https://ams.amazon.com/",
    });
    chrome.notifications.onClicked.addListener((clickId) => {
        if (clickId == notificationId)
            chrome.tabs.create({ url: "https://ams.amazon.com/ads/dashboard" });
    });
}
