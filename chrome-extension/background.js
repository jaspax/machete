const getSessionKey = req => `session_${req.entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
const serviceUrl = 'https://fierce-caverns-29914.herokuapp.com';

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action == 'setSession')
        setSession(req, sendResponse);
    else if (req.action == 'requestData')
        requestData(req, sendResponse);
    else if (req.action == 'getDataHistory')
        getDataHistory(req.entityId, req.campaignId, sendResponse);
    else 
        sendResponse('unknown action');
    return true;
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    let timestamp = Date.now();
    requestData({entityId}, (data) => storeDataCloud(entityId, timestamp, data));
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

function requestData(req, sendResponse) {
    let sessionKey = getSessionKey(req);
    let url = 'https://ams.amazon.com/api/rta/campaigns';
    document.cookie = localStorage.getItem(sessionKey);
    console.log('requesting for', sessionKey);
    $.ajax(url, {
        method: 'GET',
        data: {
            entityId: req.entityId,
            /* TODO: use these once Amazon actually supports them
            status: null,
            startDate: null,
            endDate: null,
            */
        },
        dataType: 'json',
        success: (data, textStatus, xhr) => {
            sendResponse(data);
            console.log(textStatus, ": ", data);
        },
        error: (xhr, textStatus, error) => {
            sendResponse(error);
            console.warn(textStatus, ": ", error);
        },
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
