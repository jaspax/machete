const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
let serviceUrl = 'https://machete-app.com';

function checkEntityId(entityId, sendResponse) {
    const valid = entityId && entityId != 'undefined' && entityId != 'null';
    if (valid)
        return valid;
    if (sendResponse)
        sendResponse({error: 'invalid entityId: ' + entityId});
    return false;
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
    else if (req.action == 'getUser')
        getUser(sendResponse);
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
        sendResponse({error: 'unknown action'});
    return true;
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    if (!checkEntityId(entityId)) {
        chrome.alarms.clear(session.name, cleared => console.log("cleared useless alarm", cleared));
        return;
    }

    requestCampaignData(entityId, (response) => {
        response.error ? merror("requestCampaignData", response.error)
                       : console.log('request data success');
    });
});

function setSession(req, sendResponse) {
    let sessionKey = getSessionKey(req.entityId);
    
    // Always request data on login, then set the alarm
    let lastCampaignData = localStorage.getItem(getCampaignDataKey(req.entityId));
    if (!lastCampaignData || Date.now() - lastCampaignData >= span.hour) {
        requestCampaignData(req.entityId, (response) => {
            response.error ? merror("requestCampaignData", response.error)
                           : console.log('requestCampaignData success');
        });
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
    sendResponse({data: 'ok'});
}

function getUser(sendResponse) {
    return $.ajax({
        url: `${serviceUrl}/api/user`,
        method: 'GET',
        dataType: 'json',
        success: (data) => sendResponse({data}),
        error: (xhr, status, error) => sendResponse({status, error}),
    });
}

function getAllowedCampaigns(entityId, sendResponse) {
    if (!checkEntityId(entityId, sendResponse))
        return Promise.resolve([]);
    return $.ajax({
        url: `${serviceUrl}/api/data/${entityId}/allowed`,
        method: 'GET',
        dataType: 'json',
        success: (data) => sendResponse({data}),
        error: (xhr, status, error) => sendResponse({status, error}),
    });
}

function requestCampaignData(entityId, sendResponse) {
    if (!checkEntityId(entityId, sendResponse))
        return;
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
            if (data && data.aaData && data.aaData.length) {
                let campaignIds = data.aaData.map(x => x.campaignId);
                requestCampaignStatus(entityId, campaignIds, timestamp);
            }
            storeDataCloud(entityId, timestamp, data)
                .then(() => sendResponse({data}))
                .fail((error) => sendResponse({status, error}));
        },
        error: (xhr, textStatus, error) => {
            if (xhr.status == 401) { // Unauthorized
                notifyNeedCredentials(entityId);
                return;
            }
            sendResponse({status, error});
        },
    });

    localStorage.setItem(getCampaignDataKey(entityId), timestamp);
}

function requestCampaignStatus(entityId, campaignIds, timestamp) {
    $.ajax('https://ams.amazon.com/api/rta/campaign-status', {
        method: 'GET',
        data: { 
            entityId, 
            campaignIds: campaignIds.join(','),
        },
        dataType: 'json',
        success: (data) => {
            storeStatusCloud(entityId, timestamp, data)
                .then(() => console.log('stored campaign status data successfully'))
                .fail((error) => merror('requestCampaignStatus error', error));
        },
        error: (xhr, textStatus, error) => {
            console.log('error storing campaign status', error);
        },
    });
}

function requestKeywordData(entityId, adGroupId, sendResponse) {
    if (!checkEntityId(entityId, sendResponse))
        return;
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
            if (data.message) {
                sendResponse({status: 200, error: data.message});
            }
            else {
                storeKeywordDataCloud(entityId, adGroupId, timestamp, data)
                    .then(() => sendResponse({data}))
                    .fail((error) => sendResponse({error}));
            }
        },
        error: (xhr, status, error) => sendResponse({status, error}),
    });
}

function storeDataCloud(entityId, timestamp, data) {
    return $.ajax({
        url: `${serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('cloud storage', status), 
        error: (xhr, status, error) => merror('storeDataCloud', status, error),
    });
}

function storeStatusCloud(entityId, timestamp, data) {
    return $.ajax({
        url: `${serviceUrl}/api/campaignStatus/${entityId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('status storage', status), 
        error: (xhr, status, error) => merror('storeStatusCloud', status, error),
    });
}

function storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
    return $.ajax({
        url: `${serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('keyword storage', status), 
        error: (xhr, status, error) => merror('storeKeywordDataCloud', status, error),
    });
}

function getDataHistory(entityId, campaignId, sendResponse) { // TODO: date ranges, etc.
    if (!checkEntityId(entityId, sendResponse))
        return;
    $.ajax({
        url: `${serviceUrl}/api/data/${entityId}/${campaignId}`,
        method: 'GET',
        dataType: 'json',
        success: (data) => {
            sendResponse({data});
        },
        error: (xhr, status, error) => {
            sendResponse({status, error});
        },
    });
}

function getKeywordData(entityId, adGroupId, sendResponse) {
    if (!checkEntityId(entityId, sendResponse))
        return;
    $.ajax({
        url: `${serviceUrl}/api/keywordData/${entityId}/${adGroupId}`,
        method: 'GET',
        dataType: 'json',
        success: (data) => {
            sendResponse({data});
        },
        error: (xhr, status, error) => {
            sendResponse({status, error});
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
        mga('event', 'credential-popup', 'show');
        chrome.notifications.onClicked.addListener((clickId) => {
            if (clickId == notificationId) {
                mga('event', 'credential-popup', 'click');
                chrome.tabs.create({ url: "https://ams.amazon.com/ads/dashboard" });
                chrome.notifications.clear(notificationId);
                notificationExists = false;
            }
        });
        chrome.notifications.onClosed.addListener(() => {
            notificationExists = false;
            mga('event', 'credential-popup', 'dismiss');
        });
    }
}
