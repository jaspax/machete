const getSessionKey = req => `session_${req.entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');
const getIndexKey = entityId => `index_${entityId}`;
const getDataKey = (entityId, timestamp) => `data_${entityId}_${timestamp}`;
const getTimestampFromKey = dataKey => dataKey.split('_').pop();

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action == 'setSession')
        setSession(req, sendResponse);
    else if (req.action == 'requestData')
        requestData(req, sendResponse);
    else if (req.action == 'getDataHistory')
        getDataHistory(req.entityId, sendResponse);
    else 
        sendResponse('unknown action');
    return true;
});

chrome.alarms.onAlarm.addListener((session) => {
    let entityId = getEntityIdFromSession(session.name);
    let timestamp = Date.now();
    requestData({entityId}, (data) => storeData(entityId, timestamp, data));
});

function setSession(req, sendResponse) {
    let sessionKey = getSessionKey(req);
    localStorage.setItem(sessionKey, req.cookies);
    console.log('stored cookies', sessionKey, req.cookies);
    chrome.alarms.get(sessionKey, (alarm) => {
        if (!alarm) {
            let period = chrome.management.getSelf().installType == 'development' ? 1 : 60;
            chrome.alarms.create(sessionKey, {
                when: Date.now() + 500,
                periodInMinutes: period,
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

function storeData(entityId, timestamp, data) {
    // We store an 'index', which is a serialized array of keys which contain
    // timestamped data. When storing data, we first have to append to the index
    // then store the data in the actual key.
    let dataKey = getDataKey(entityId, timestamp);
    let json = JSON.stringify(data);
    localStorage.setItem(dataKey, json);

    storeIndex(entityId, dataKey);
}

function getIndex(entityId) {
    let indexKey = getIndexKey(entityId);
    let indexJson = localStorage.getItem(indexKey);
    let index = [];
    if (indexJson) {
        index = JSON.parse(indexJson);
    }
    return index;
}

function storeIndex(entityId, dataKey) {
    let indexKey = getIndexKey(entityId);
    let indexJson = localStorage.getItem(indexKey);
    let index = [];
    if (indexJson) {
        index = JSON.parse(indexJson);
    }
    index.push(dataKey);
    localStorage.setItem(indexKey, JSON.stringify(index));
}

function getDataHistory(entityId, sendResponse) { // TODO: date ranges, etc.
    let dataList = [];
    let index = getIndex(entityId);
    for (let dataKey of index) {
        let dataJson = localStorage.getItem(dataKey);
        if (dataJson) {
            let data = JSON.parse(dataJson);
            if (data && typeof data == 'object') {
                data.timestamp = getTimestampFromKey(dataKey);
                dataList.push(data);
            }
        }
    }
    sendResponse(dataList);
}
