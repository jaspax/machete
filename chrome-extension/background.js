const getSessionKey = entityId => `session_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
const serviceUrl = 'https://fierce-caverns-29914.herokuapp.com';

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action == 'setSession')
        setSession(req, sendResponse);
    else if (req.action == 'requestData')
        requestData(req.entityId, sendResponse);
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
    let timestamp = Date.now();
    requestData(entityId, (data) => {
        if (data.error) {
            console.warn('request data', data.error);
            return;
        }
        console.log('request data success');
        storeDataCloud(entityId, timestamp, data.data);
    });
});

function setSession(req, sendResponse) {
    /* TODO: this way of getting session doesn't actually work, alas.
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

    let sessionKey = getSessionKey(req);
    localStorage.setItem(sessionKey, req.cookies);
    console.log('stored cookies', sessionKey, req.cookies);
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
}

function requestData(entityId, sendResponse) {
    let sessionKey = getSessionKey(entityId);
    let url = 'https://ams.amazon.com/api/rta/campaigns';
    document.cookie = localStorage.getItem(sessionKey);
    console.log('requesting campaign data for', entityId);
    $.ajax(url, {
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
        success: (data, textStatus, xhr) => sendResponse({data}),
        error: (xhr, textStatus, error) => sendResponse({error}),
    });
}

function requestKeywordData(entityId, adGroupId, sendResponse) {
    let sessionKey = getSessionKey(entityId);
    let url = 'https://ams.amazon.com/api/sponsored-products/getAdGroupKeywordList';
    document.cookie = localStorage.getItem(sessionKey);
    console.log('requesting keyword data for', entityId, adGroupId);
    $.ajax(url, {
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
        success: (data, textStatus, xhr) => { storeKeywordDataCloud(entityId, adGroupId, Date.now(), data); sendResponse({data}) },
        error: (xhr, textStatus, error) => sendResponse({error}),
    });
}

function storeDataCloud(entityId, timestamp, data) {
    $.ajax({
        url: `${serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: (data, status) => console.log('cloud storage', status), 
        error: (xhr, status, error) => console.warn('cloud storage', status, error),
    });
}

function storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
    $.ajax({
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
