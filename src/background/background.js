const co = require('co');
const ga = require('../common/ga.js');
const constants = require('../common/constants.js');
const bg = require('../common/background.js');
const common = require('../common/common.js');

const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');

const alarmPeriodMinutes = 240;

function checkEntityId(entityId) {
    if (!(entityId && entityId != 'undefined' && entityId != 'null')) {
        throw new Error(`invalid entityId={${entityId}}`);
    }
}

bg.messageListener(function*(req, sender) {
    if (req.action == 'setSession')
        return yield* setSession(req, sender);
    else if (req.action == 'getUser')
        return yield* bg.getUser();
    else if (req.action == 'getAllowedCampaigns') 
        return yield* getAllowedCampaigns(req.entityId);
    else if (req.action == 'getCampaignSummaries') 
        return yield* getCampaignSummaries(req.entityId);
    else if (req.action == 'getDataHistory')
        return yield* getDataHistory(req.entityId, req.campaignId);
    else if (req.action == 'getAggregateCampaignHistory')
        return yield* getAggregateCampaignHistory(req.entityId, req.campaignIds);
    else if (req.action == 'getKeywordData')
        return yield* getKeywordData(req.entityId, req.adGroupId);
    else if (req.action == 'setCampaignMetadata')
        return yield* setCampaignMetadata(req.entityId, req.campaignId, req.asin);
    else if (req.action == 'setAdGroupMetadata')
        return yield* setAdGroupMetadata(req.entityId, req.adGroupId, req.campaignId);
    else if (req.action == 'updateKeyword')
        return yield* updateKeyword(req.entityId, req.keywordIdList, req.operation, req.dataValues);
    throw new Error('unknown action');
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

function* pageArray(array, step) {
    for (let index = 0; index < array.length; index += step) {
        yield array.slice(index, index + step);
    }
}

function* alarmHandler(entityId) {
    console.log('Alarm handler start at', new Date());

    // This will throw if we can't get through, effectively calling the whole
    // thing off.
    yield* requestCampaignData(entityId);

    const adGroups = yield* getAdGroups(entityId);
    for (const item of adGroups) {
        yield* requestKeywordData(entityId, item.adGroupId);
    }

    console.log('Alarm handler finish at', new Date());
}

function* setSession(req, sender) {
    console.log('page session startup for', req);
    let sessionKey = getSessionKey(req.entityId);
    
    chrome.pageAction.show(sender.tab.id);
    yield ga.mpromise(resolve => {
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

    // Always request data on login, then set the alarm
    let lastCampaignData = localStorage.getItem(getCampaignDataKey(req.entityId));
    if (!lastCampaignData || Date.now() - lastCampaignData >= constants.timespan.minute * alarmPeriodMinutes) {
        yield* alarmHandler(req.entityId);
    }
}

function* getAllowedCampaigns(entityId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        dataType: 'json'
    });
}

function* getCampaignSummaries(entityId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/summary`, { 
        method: 'GET',
        dataType: 'json'
    });
}

function* requestCampaignData(entityId) {
    checkEntityId(entityId);
    const lastRequestSucceeded = JSON.parse(localStorage.getItem('lastRequestSucceeded'));

    let timestamp = Date.now();
    let data = null;
    try {
        console.log('requesting campaign data for', entityId);
        data = yield bg.ajax('https://ams.amazon.com/api/rta/campaigns', {
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
        if (bg.handleAuthErrors(ex) && lastRequestSucceeded) {
            localStorage.setItem('lastRequestSucceeded', false);
            notifyNeedCredentials(entityId);
            return null;
        }
        throw ex;
    }
    localStorage.setItem('lastRequestSucceeded', true);
    yield* storeDataCloud(entityId, timestamp, data);

    if (data && data.aaData && data.aaData.length) {
        let campaignIds = data.aaData.map(x => x.campaignId);
        yield* requestCampaignStatus(entityId, campaignIds, timestamp);
    }

    localStorage.setItem(getCampaignDataKey(entityId), timestamp);
    return data;
}

function* requestCampaignStatus(entityId, campaignIds, timestamp) {
    checkEntityId(entityId); 

    const step = 20;
    let index = 0;

    // Chop the campaignId list into bite-sized chunks
    while (index < campaignIds.length) {
        let chunk = campaignIds.slice(index, index + step);

        const data = yield bg.ajax('https://ams.amazon.com/api/rta/campaign-status', {
            method: 'GET',
            data: { 
                entityId, 
                campaignIds: chunk.join(','),
            },
            dataType: 'json',
        });

        yield* storeStatusCloud(entityId, timestamp, data);
        index += step;
    }
}

function* requestKeywordData(entityId, adGroupId) {
    checkEntityId(entityId);

    let timestamp = Date.now();
    console.log('requesting keyword data for', entityId, adGroupId);
    const data = yield bg.ajax('https://ams.amazon.com/api/sponsored-products/getAdGroupKeywordList', {
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
        ga.mga('event', 'error-handled', 'keyword-data-failure', `${adGroupId}: ${data.message}`);
        return;
    }

    yield* storeKeywordDataCloud(entityId, adGroupId, timestamp, data);
}

function* storeDataCloud(entityId, timestamp, data) {
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeStatusCloud(entityId, timestamp, data) {
    return yield bg.ajax(`${bg.serviceUrl}/api/campaignStatus/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
    // Break data.aaData into chunks
    const step = 50;
    let index = 0;

    // Chop the large keyword list into small, bite-sized chunks for easier
    // digestion on the server.
    while (index < data.aaData.length) {
        let chunk = { aaData: data.aaData.slice(index, index + step) };

        yield bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`, {
            method: 'PUT',
            data: JSON.stringify(chunk),
            contentType: 'application/json',
        });

        index += step;
    }
}

let campaignPromise = {};
function* getDataHistory(entityId, campaignId) { // TODO: date ranges, etc.
    checkEntityId(entityId);

    const key = entityId + '-' + campaignId;
    if (!campaignPromise[key]) {
        campaignPromise[key] = bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/${campaignId}`, { 
            method: 'GET',
            dataType: 'json'
        });
    }

    try {
        const snapshots = yield campaignPromise[key];
        return common.convertSnapshotsToDeltas(snapshots);
    }
    catch(error) {
        campaignPromise[key] = null;
        throw error;
    }
}

function* getAggregateCampaignHistory(entityId, campaignIds) {
    let aggregate = [];
    for (const page of pageArray(campaignIds, 6)) {
        const promises = [];
        for (const campaignId of page) {
            promises.push(co(function*() {
                let history = yield getDataHistory(entityId, campaignId);
                aggregate = aggregate.concat(...history);
            }));
        }
        yield Promise.all(promises);
    }

    return aggregate.sort((a, b) => a.timestamp - b.timestamp);
}

function* getKeywordData(entityId, adGroupId) {
    checkEntityId(entityId);

    const ajaxOptions = {
        url: `${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}`,
        method: 'GET',
        dataType: 'json',
    };
    let data = yield bg.ajax(ajaxOptions);

    if (!data || data.length == 0) {
        // Possibly this is the first time we've ever seen this campaign. If so,
        // let's query Amazon and populate our own servers, and then come back.
        // This is very slow but should usually only happen once.
        yield* requestKeywordData(entityId, adGroupId);
        data = yield bg.ajax(ajaxOptions);
    }

    return data;
}

function* setCampaignMetadata(entityId, campaignId, asin) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/campaignMetadata/${entityId}/${campaignId}`, {
        method: 'PUT',
        data: JSON.stringify({ asin }),
        contentType: 'application/json',
    });
}

function* setAdGroupMetadata(entityId, adGroupId, campaignId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/adGroupMetadata/${entityId}/${adGroupId}`, {
        method: 'PUT',
        data: JSON.stringify({ campaignId }),
        contentType: 'application/json',
    });
}

function* getAdGroups(entityId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/adGroups/${entityId}`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* updateKeyword(entityId, keywordIdList, operation, dataValues) {
    // TODO: the parameters to the Amazon API imply that you can pass more than
    // 1 keyword at a time, but testing this shows that doing so just generates
    // an error. So we do it the stupid way instead, with a loop.
    const step = 20;
    const timestamp = Date.now();

    const results = [];
    for (let index = 0; index < keywordIdList.length; index += step) {
        let requests = [];
        let chunk = keywordIdList.slice(index, index + step);
        for (let id of chunk) {
            let postData = Object.assign({operation, entityId, keywordIds: id}, dataValues);
            requests.push(bg.ajax({
                url: 'https://ams.amazon.com/api/sponsored-products/updateKeywords/',
                method: 'POST',
                data: postData,
                dataType: 'json',
            }));
        }

        const responses = yield Promise.all(requests);
        const successes = chunk.filter((x, index) => responses[index].success);
        yield bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}?timestamp=${timestamp}`, {
            method: 'PATCH',
            dataType: 'json',
            data: JSON.stringify({ operation, dataValues, keywordIds: successes }),
            contentType: 'application/json',
        });

        results.concat(...responses);
    }

    // TODO: in the case that we have a lot of these (bulk update), implement
    // progress feedback.
    return { success: results.every(x => x.success) };
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
