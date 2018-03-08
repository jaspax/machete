const bg = require('../common/background.js');
const co = require('co');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const moment = require('moment');

const getSessionKey = entityId => `session_${entityId}`;
const getCampaignDataKey = entityId => `campaignData_${entityId}`;
const getEntityIdFromSession = session => session.replace('session_', '');

const alarmPeriodMinutes = 12 * 60;

function checkEntityId(entityId) {
    if (!(entityId && entityId != 'undefined' && entityId != 'null')) {
        throw new Error(`invalid entityId={${entityId}}`);
    }
}

bg.messageListener(function*(req) {
    if (req.action == 'setSession')
        return yield setSession(req);
    else if (req.action == 'getUser')
        return yield bg.getUser();
    else if (req.action == 'getAllowedCampaigns') 
        return yield getAllowedCampaigns(req.entityId);
    else if (req.action == 'getCampaignSummaries') 
        return yield getCampaignSummaries(req.entityId);
    else if (req.action == 'getAllCampaignData')
        return yield getAllCampaignData(req.entityId, req.start, req.end);
    else if (req.action == 'getDataHistory')
        return yield getDataHistory(req.entityId, req.campaignId);
    else if (req.action == 'getAggregateCampaignHistory')
        return yield getAggregateCampaignHistory(req.entityId, req.campaignIds);
    else if (req.action == 'getKeywordData')
        return yield getKeywordData(req.entityId, req.adGroupId);
    else if (req.action == 'getAggregateKeywordData')
        return yield getAggregateKeywordData(req.entityId, req.adGroupIds);
    else if (req.action == 'setCampaignMetadata')
        return yield setCampaignMetadata(req.entityId, req.campaignId, req.asin);
    else if (req.action == 'setAdGroupMetadata')
        return yield setAdGroupMetadata(req.entityId, req.adGroupId, req.campaignId);
    else if (req.action == 'updateKeyword')
        return yield updateKeyword(req.entityId, req.keywordIdList, req.operation, req.dataValues);
    throw new Error('unknown action');
});

chrome.alarms.onAlarm.addListener(ga.mcatch(session => {
    let entityId = getEntityIdFromSession(session.name);
    try {
        checkEntityId(entityId);
    }
    catch (ex) {
        chrome.alarms.clear(session.name, cleared => console.log("cleared useless alarm", cleared));
        return;
    }

    co(dataSync(entityId));
}));

function* pageArray(array, step) {
    for (let index = 0; index < array.length; index += step) {
        yield array.slice(index, index + step);
    }
}

function* dataSync(entityId) {
    console.log('Data sync start at', moment().format());

    const lastDataSync = moment(Number(localStorage.getItem(getCampaignDataKey(entityId))));
    console.log('Last data sync was', lastDataSync.format());
    if (moment().isSame(lastDataSync, 'day')) {
        console.log('Data sync is up-to-date');
        return lastDataSync.valueOf();
    }

    const lastRequestSucceeded = JSON.parse(localStorage.getItem('lastRequestSucceeded'));
    try {
        yield* requestCampaignData(entityId);

        const adGroups = yield* getAdGroups(entityId);
        for (const item of adGroups) {
            yield* requestKeywordData(entityId, item.adGroupId);
        }
        bg.cache.clear();
    }
    catch (ex) {
        if (bg.handleServerErrors(ex, 'dataSync')) {
            localStorage.setItem('lastRequestSucceeded', false);
            if (lastRequestSucceeded)
                notifyNeedCredentials(entityId);
            return null;
        }
        throw ex;
    }
    localStorage.setItem('lastRequestSucceeded', true);

    const now = moment();
    localStorage.setItem(getCampaignDataKey(entityId), now.toDate().getTime());
    console.log('Data sync finish at', now.format());

    return now;
}

function* setSession(req) {
    console.log('page session startup for', req);
    let sessionKey = getSessionKey(req.entityId);
    
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

    const lastDataSync = yield* dataSync(req.entityId);
    return lastDataSync;
}

const getAllowedCampaigns = bg.cache.coMemo(function*(entityId) {
    checkEntityId(entityId);
    const allowed = yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        dataType: 'json'
    });

    if (allowed.length)
        return allowed;

    // nb: setSession is memoized so this should never actually rerun, it just
    // makes us wait until setSession is done
    yield setSession({ entityId });

    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        dataType: 'json'
    });
}, { maxAge: 30000 });

const getCampaignSummaries = bg.cache.coMemo(function*(entityId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/summary`, { 
        method: 'GET',
        dataType: 'json'
    });
}, { maxAge: 30000 });

function* requestCampaignData(entityId) {
    checkEntityId(entityId);

    console.log('requesting campaign data for', entityId);
    const missing = yield* getMissingDates(entityId);

    let earliestData = null;
    yield bg.parallelQueue(missing.missingDays, function*(date) {
        const data = yield bg.ajax('https://ams.amazon.com/api/rta/campaigns', {
            method: 'GET',
            data: {
                entityId,
                status: 'Customized',
                reportStartDate: date,
                reportEndDate: date,
            },
            dataType: 'json',
        });

        if (!earliestData)
            earliestData = data;

        yield* storeDailyCampaignData(entityId, date, data);
    });

    let timestamp = Date.now();
    if (earliestData && earliestData.aaData && earliestData.aaData.length) {
        let campaignIds = earliestData.aaData.map(x => x.campaignId);
        yield* requestCampaignStatus(entityId, campaignIds, timestamp);
    }

    if (missing.needLifetime) {
        const data = yield bg.ajax('https://ams.amazon.com/api/rta/campaigns', {
            method: 'GET',
            data: {
                entityId,
                status: 'Lifetime',
            },
            dataType: 'json',
        });
        yield* storeLifetimeCampaignData(entityId, Date.now(), data);
    }

    return earliestData;
}

function* requestCampaignStatus(entityId, campaignIds, timestamp) {
    checkEntityId(entityId); 

    // Chop the campaignId list into bite-sized chunks
    for (const chunk of pageArray(campaignIds, 20)) {
        const data = yield bg.ajax('https://ams.amazon.com/api/rta/campaign-status', {
            method: 'GET',
            data: { 
                entityId, 
                campaignIds: chunk.join(','),
            },
            dataType: 'json',
        });

        yield* storeStatusCloud(entityId, timestamp, data);
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

function* storeDailyCampaignData(entityId, timestamp, data) {
    return yield bg.ajax(`${bg.serviceUrl}/api/campaignData/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeLifetimeCampaignData(entityId, timestamp, data) {
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
    // Chop the large keyword list into small, bite-sized chunks for easier
    // digestion on the server.
    for (const chunk of pageArray(data.aaData, 50)) {
        yield bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`, {
            method: 'PUT',
            data: JSON.stringify({ aaData: chunk }),
            contentType: 'application/json',
        });
    }
}

function* getMissingDates(entityId) {
    return yield bg.ajax(`https://${constants.hostname}/api/campaignData/${entityId}/missingDates`, {
        method: 'GET',
        dataType: 'json',
    });
}

const getCampaignHistory = bg.cache.coMemo(function*(entityId, campaignId) { // TODO: date ranges, etc.
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/${campaignId}`, { 
        method: 'GET',
        dataType: 'json'
    });
});

const getAllCampaignData = bg.cache.coMemo(function*(entityId, startTimestamp, endTimestamp) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`, { 
        method: 'GET',
        dataType: 'json'
    });
});

const getDataHistory = bg.cache.coMemo(function*(entityId, campaignId) { // TODO: date ranges, etc.
    const snapshots = yield getCampaignHistory(entityId, campaignId);
    return common.convertSnapshotsToDeltas(snapshots);
});

const getAggregateCampaignHistory = bg.cache.coMemo(function*(entityId, campaignIds) {
    let aggregate = [];
    for (const page of pageArray(campaignIds, 6)) {
        const promises = [];
        for (const campaignId of page) {
            promises.push(co(function*() {
                try {
                    let history = yield getDataHistory(entityId, campaignId);
                    aggregate = aggregate.concat(...history);
                }
                catch (ex) {
                    if (bg.handleServerErrors(ex) == 'notAllowed') {
                        // swallow this
                    }
                    throw ex;
                }
            }));
        }
        yield Promise.all(promises);
    }

    return aggregate.sort((a, b) => a.timestamp - b.timestamp);
});

const getKeywordData = bg.cache.coMemo(function*(entityId, adGroupId) {
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
});

const getAggregateKeywordData = bg.cache.coMemo(function*(entityId, adGroupIds) {
    let keywordSets = [];

    for (const page of pageArray(adGroupIds, 6)) {
        const kwSets = yield Promise.all(page.map(adGroupId => co(function*() {
            try {
                return yield getKeywordData(entityId, adGroupId);
            }
            catch (ex) {
                if (bg.handleServerErrors(ex) == 'notAllowed') {
                    return []; // don't destroy the whole thing when only one item is unavailable
                }
                throw ex;
            }
        })));
        keywordSets = keywordSets.concat(kwSets);
    }

    return keywordSets;
});

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
    const timestamp = Date.now();

    const results = [];
    for (const chunk of pageArray(keywordIdList, 6)) {
        let requests = [];
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
        chrome.notifications.onClicked.addListener(ga.mcatch(clickId => {
            if (clickId == notificationId) {
                ga.mga('event', 'credential-popup', 'click');
                chrome.tabs.create({ url: "https://ams.amazon.com/ads/dashboard" });
                chrome.notifications.clear(notificationId);
                notificationExists = false;
            }
        }));
        chrome.notifications.onClosed.addListener(ga.mcatch(() => {
            notificationExists = false;
            ga.mga('event', 'credential-popup', 'dismiss');
        }));
    }
}
