const bg = require('./common.js');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');

function checkEntityId(entityId) {
    if (!(entityId && entityId != 'undefined' && entityId != 'null')) {
        throw new Error(`invalid entityId={${entityId}}`);
    }
}

function* pageArray(array, step) {
    for (let index = 0; index < array.length; index += step) {
        yield array.slice(index, index + step);
    }
}

function* dataGather() {
    for (const { domain, entityId } of bg.getEntityIds()) {
        try {
            yield* requestCampaignData(domain, entityId);

            const adGroups = yield* getAdGroups(entityId);
            yield bg.parallelQueue(adGroups, function*(item) {
                yield* requestKeywordData(domain, entityId, item.adGroupId);
            });
        }
        catch (ex) {
            if (!bg.handleServerErrors(ex, 'sp.dataSync:' + entityId))
                ga.mex(ex);
        }
    }
}

const getAllowedCampaigns = bg.cache.coMemo(function*({ entityId }) {
    checkEntityId(entityId);
    const allowed = yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        responseType: 'json'
    });

    if (allowed.length)
        return allowed;

    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        responseType: 'json'
    });
}, { maxAge: 30000 });

const getCampaignSummaries = bg.cache.coMemo(function*({ entityId }) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/summary`, { 
        method: 'GET',
        responseType: 'json'
    });
}, { maxAge: 30000 });

function* requestCampaignData(domain, entityId) {
    checkEntityId(entityId);

    console.log('requesting campaign data for', entityId);
    const missing = yield* getMissingDates(entityId);

    let earliestData = null;
    yield bg.parallelQueue(missing.missingDays, function*(date) {
        const data = yield bg.ajax(`https://${domain}/api/rta/campaigns`, {
            method: 'GET',
            queryData: {
                entityId,
                status: 'Customized',
                reportStartDate: date,
                reportEndDate: date,
            },
            responseType: 'json',
        });

        if (!earliestData)
            earliestData = data;

        yield* storeDailyCampaignData(entityId, date, data);
    });

    let timestamp = Date.now();
    if (earliestData && earliestData.aaData && earliestData.aaData.length) {
        let campaignIds = earliestData.aaData.map(x => x.campaignId);
        yield* requestCampaignStatus(domain, entityId, campaignIds, timestamp);
    }

    if (missing.needLifetime) {
        const data = yield bg.ajax(`https://${domain}/api/rta/campaigns`, {
            method: 'GET',
            queryData: {
                entityId,
                status: 'Lifetime',
            },
            responseType: 'json',
        });
        yield* storeLifetimeCampaignData(entityId, Date.now(), data);
    }

    return earliestData;
}

function* requestCampaignStatus(domain, entityId, campaignIds, timestamp) {
    checkEntityId(entityId); 

    // Chop the campaignId list into bite-sized chunks
    for (const chunk of pageArray(campaignIds, 20)) {
        const data = yield bg.ajax(`https://${domain}/api/rta/campaign-status`, {
            method: 'GET',
            queryData: {
                entityId, 
                campaignIds: chunk.join(','),
            },
            responseType: 'json',
        });

        yield* storeStatusCloud(entityId, timestamp, data);
    }
}

function* requestKeywordData(domain, entityId, adGroupId) {
    checkEntityId(entityId);

    let timestamp = Date.now();
    console.log('requesting keyword data for', entityId, adGroupId);
    const data = yield bg.ajax(`https://${domain}/api/sponsored-products/getAdGroupKeywordList`, {
        method: 'POST',
        formData: {
            entityId, adGroupId,
            /* TODO: use these once Amazon actually supports them
            status: null,
            startDate: null,
            endDate: null,
            */
        },
        responseType: 'json',
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
        jsonData: data,
        contentType: 'application/json',
    });
}

function* storeLifetimeCampaignData(entityId, timestamp, data) {
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

function* storeStatusCloud(entityId, timestamp, data) {
    return yield bg.ajax(`${bg.serviceUrl}/api/campaignStatus/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

function* storeKeywordDataCloud(entityId, adGroupId, timestamp, data) {
    // Chop the large keyword list into small, bite-sized chunks for easier
    // digestion on the server.
    for (const chunk of pageArray(data.aaData, 50)) {
        yield bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`, {
            method: 'PUT',
            jsonData: { aaData: chunk },
            contentType: 'application/json',
        });
    }
}

function* getMissingDates(entityId) {
    return yield bg.ajax(`https://${constants.hostname}/api/campaignData/${entityId}/missingDates`, {
        method: 'GET',
        responseType: 'json',
    });
}

const getCampaignHistory = bg.cache.coMemo(function*(entityId, campaignId) { // TODO: date ranges, etc.
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/${campaignId}`, { 
        method: 'GET',
        responseType: 'json'
    });
});

const getAllCampaignData = bg.cache.coMemo(function*({ entityId, startTimestamp, endTimestamp }) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`, { 
        method: 'GET',
        responseType: 'json'
    });
});

const getDataHistory = bg.cache.coMemo(function*({ entityId, campaignId }) { // TODO: date ranges, etc.
    const snapshots = yield getCampaignHistory(entityId, campaignId);
    return common.convertSnapshotsToDeltas(snapshots);
});

const getAggregateCampaignHistory = bg.cache.coMemo(function*({ entityId, campaignIds }) {
    let aggregate = [];
    yield bg.parallelQueue(campaignIds, function*(campaignId) {
        try {
            let history = yield getDataHistory({ entityId, campaignId });
            aggregate = aggregate.concat(...history);
        }
        catch (ex) {
            if (bg.handleServerErrors(ex) == 'notAllowed') {
                // swallow this
            }
            throw ex;
        }
    });

    return aggregate.sort((a, b) => a.timestamp - b.timestamp);
});

const getKeywordData = bg.cache.coMemo(function*({ domain, entityId, adGroupId }) {
    checkEntityId(entityId);
    const url = `${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}`;
    const opts = {
        method: 'GET',
        responseType: 'json',
    };
    let data = yield bg.ajax(url, opts);

    if (!data || data.length == 0) {
        // Possibly this is the first time we've ever seen this campaign. If so,
        // let's query Amazon and populate our own servers, and then come back.
        // This is very slow but should usually only happen once.
        yield* requestKeywordData(domain, entityId, adGroupId);
        data = yield bg.ajax(url, opts);
    }

    return data;
});

const getAggregateKeywordData = bg.cache.coMemo(function*({ domain, entityId, adGroupIds }) {
    return yield bg.parallelQueue(adGroupIds, function*(adGroupId) {
        try {
            return yield getKeywordData({ domain, entityId, adGroupId });
        }
        catch (ex) {
            if (bg.handleServerErrors(ex) == 'notAllowed') {
                // swallow this
            }
            throw ex;
        }
    });
});

function* setCampaignMetadata({ entityId, campaignId, asin }) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/campaignMetadata/${entityId}/${campaignId}`, {
        method: 'PUT',
        jsonData: { asin },
    });
}

function* setAdGroupMetadata({ entityId, adGroupId, campaignId }) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/adGroupMetadata/${entityId}/${adGroupId}`, {
        method: 'PUT',
        jsonData: { campaignId },
    });
}

function* getAdGroups(entityId) {
    checkEntityId(entityId);
    return yield bg.ajax(`${bg.serviceUrl}/api/adGroups/${entityId}`, {
        method: 'GET',
        responseType: 'json',
    });
}

function* updateKeyword({ domain, entityId, keywordIdList, operation, dataValues }) {
    // TODO: the parameters to the Amazon API imply that you can pass more than
    // 1 keyword at a time, but testing this shows that doing so just generates
    // an error. So we do it the stupid way instead, with a loop.
    const timestamp = Date.now();

    const successes = [];
    yield bg.parallelQueue(keywordIdList, function*(id) {
        const response = yield bg.ajax(`https://${domain}/api/sponsored-products/updateKeywords/`, {
            method: 'POST',
            formData: Object.assign({operation, entityId, keywordIds: id}, dataValues),
            responseType: 'json',
        });
        if (response.success) {
            successes.push(id);
        }
    });

    yield bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}?timestamp=${timestamp}`, {
        method: 'PATCH',
        jsonData: { operation, dataValues, keywordIds: successes },
        responseType: 'json',
    });

    // TODO: in the case that we have a lot of these (bulk update), implement
    // progress feedback.
    return { success: successes.length == keywordIdList.length };
}

module.exports = {
    name: 'sp',
    dataGather,
    getAllowedCampaigns, 
    getCampaignSummaries, 
    getAllCampaignData,
    getDataHistory,
    getAggregateCampaignHistory,
    getKeywordData,
    getAggregateKeywordData,
    setCampaignMetadata,
    setAdGroupMetadata,
    updateKeyword,
};