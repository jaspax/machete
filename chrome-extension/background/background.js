const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
let serviceUrl = 'https://machete-app.com';

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
    else if (req.action == 'getAllowedCampaigns') 
        getAllowedCampaigns(req.entityId, sendResponse);
    else if (req.action == 'requestData')
        requestCampaignData(req.entityId, sendResponse);
    else if (req.action == 'getDataHistory')
        getDataHistory(req.entityId, req.campaignId, sendResponse);
    else if (req.action == 'requestKeywordData')
        requestKeywordData(req.entityId, req.adGroupId, sendResponse);
    else if (req.action == 'getKeywordData')
        getKeywordData(req.entityId, req.adGroupId, sendResponse);
    else 
        sendResponse('unknown action');
    return true;
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    requestCampaignData(entityId, (data) => {
        data.error ? console.warn('request data', data.error)
                   : console.log('request data success');
    });
});

function setSession(req, sendResponse) {
    let sessionKey = getSessionKey(req.entityId);
    
    // Always request data on login, then set the alarm
    let lastCampaignData = localStorage.getItem(getCampaignDataKey(req.entityId));
    if (!lastCampaignData || Date.now() - lastCampaignData >= span.hour) {
        requestCampaignData(req.entityId, () => console.log("stored campaign data"));
    }
    chrome.alarms.get(sessionKey, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(sessionKey, {
                when: Date.now() + 500,
                periodInMinutes: 60,
            });
            console.log('set alarm for', sessionKey);
        }
    });
    sendResponse('ok');
}

function getAllowedCampaigns(entityId, sendResponse) {
    return $.ajax({
        url: `${serviceUrl}/api/data/${entityId}/allowed`,
        method: 'GET',
        dataType: 'json',
        success: (data) => sendResponse({data}),
        error: (xhr, status, error) => sendResponse({error}),
    });
}

function requestCampaignData(entityId, sendResponse) {
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
        success: (data) => {
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
        success: (data) => {
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

function storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
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
        success: (data) => {
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
        success: (data) => {
            sendResponse({data});
        },
        error: (xhr, status, error) => {
            sendResponse({error, status});
        },
    });
}

let notificationExists = false;
function notifyNeedCredentials(entityId) {
    if (!notificationExists) {
        let notificationId = `${prefix}-${entityId}-need-credentials`;
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
        const listener = (clickId) => {
            if (clickId == notificationId) {
                chrome.tabs.create({ url: "https://ams.amazon.com/ads/dashboard" });
                chrome.notifications.clear(notificationId);
                notificationExists = false;
            }
        };
        chrome.notifications.onClicked.addListener(listener);
        chrome.notifications.onClosed.addListener(listener);
    }
}
