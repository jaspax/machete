const getSessionKey = req => `session_${req.entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');

chrome.runtime.onStartup.addListener(() => {
    console.log("Startup...");
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action == 'setSession')
        setSession(req, sendResponse);
    else if (req.action == 'requestData')
        requestData(req, sendResponse);
    else 
        sendResponse('unknown action');
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    requestData({entityId}, (data) => console.log('alarm data', data));
});

function setSession(req, sendResponse) {
    let sessionKey = getSessionKey(req);
    localStorage.setItem(sessionKey, req.cookies);
    console.log('stored cookies', sessionKey, req.cookies);
    chrome.alarms.get(sessionKey, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(sessionKey, {
                when: Date.now() + 500,
                periodInMinutes: 1, // TODO: not this often, obviously
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
