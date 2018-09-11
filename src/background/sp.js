const bg = require('./common.js');
const _ = require('lodash');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const spData = require('../common/sp-data.js');

const spCm = require('./sp-cm.js');
const spRta = require('./sp-rta.js');

const entityDailySyncEvent = {};

function checkEntityId(entityId) {
    if (bg.isUnset(entityId)) {
        throw new Error('invalid entityId=' + entityId);
    }
}

function mkEvent() {
    const event = {};
    event.promise = new Promise((resolve, reject) => {
        event.set = val => {
            resolve(val);
            event.set = () => { /* ignore multiple sets */ };
        };
        event.error = e => {
            reject(e);
            event.error = () => { /* ignore multiple errors */ };
        };
    });

    return event;
}

function getEntitySyncEvent(entityId) {
    if (!entityDailySyncEvent[entityId]) {
        const event = mkEvent(`entity ${entityId}`);
        entityDailySyncEvent[entityId] = event;
        if (bg.hasSyncedToday('sp'))
            event.set();
    }
    return entityDailySyncEvent[entityId];
}

async function dataGather(req) {
    // We want to make sure that we at least attempt to sync every single
    // domain, but any exceptions we encounter should be propagated so that we
    // don't record this as a success.
    let deferredException = null;
    
    let entities = bg.getEntityIds();

    // if we are responding to a client request, always sync that entityId first
    if (req && req.entityId) {
        entities.unshift({ domain: req.domain, entityId: req.entityId });
        entities = _.uniqBy(entities, x => x.entityId);
    }

    for (const { domain, entityId } of entities) {
        checkEntityId(entityId);
        for (const collector of [spCm(domain, entityId), spRta(domain, entityId)]) {
            try {
                const campaignIds = await requestCampaignData(collector);
                const adGroups = await getAdGroups(entityId);
                const summaries = await getCampaignSummaries({ entityId });

                await bg.parallelQueue(campaignIds, async function(campaignId) {
                    const summary = summaries.find(x => x.campaignId == campaignId);
                    if (!spData.isRunning(summary)) {
                        return;
                    }

                    const adGroupItem = adGroups.find(x => x.campaignId == campaignId);
                    let adGroupId = null;
                    if (adGroupItem) {
                        adGroupId = adGroupItem.adGroupId;
                    }
                    else {
                        try {
                            adGroupId = await collector.getAdGroupId(campaignId);
                            if (adGroupId)
                                await storeAdGroupMetadata({ entityId: collector.entityId, adGroupId, campaignId });
                        }
                        catch (ex) {
                            if (ex.message && ex.message.match(/400/))
                                ga.mga('event', 'error-handled', 'get-adgroupid-400', campaignId);
                            else
                                throw ex;
                        }
                    }

                    if (adGroupId) {
                        if (!(summary && summary.asin)) {
                            await requestCampaignMetadata(collector, campaignId, adGroupId);
                        }
                        await requestKeywordData(collector, campaignId, adGroupId);
                    }
                });

                // Actually completing the block above with either collector
                // means that we don't need to try the other one. Sometimes this
                // means that we'll get the same data twice on both collectors,
                // but oh well.
                ga.mga('event', 'collector-complete', collector.name, domain);
                break;
            }
            catch (ex) {
                if (!bg.handleServerErrors(ex, "sp.dataGather")) {
                    ga.merror(ex, `context: domain ${domain}, entityId ${entityId}`);
                }
                deferredException = ex;
            }
        }
    }

    if (deferredException) {
        throw deferredException;
    }
}

const getAllowedCampaigns = bg.cache.coMemo(async function({ entityId }) {
    checkEntityId(entityId);
    const allowed = await bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        responseType: 'json'
    });

    if (allowed.length)
        return allowed;

    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/allowed`, { 
        method: 'GET',
        responseType: 'json'
    });
}, { maxAge: 30000 });

const getCampaignSummaries = bg.cache.coMemo(async function({ entityId }) {
    checkEntityId(entityId);

    await summaryReady(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/summary`, { 
        method: 'GET',
        responseType: 'json'
    });
}, { maxAge: 30000 });

async function summaryReady(entityId) {
    const syncEvent = getEntitySyncEvent(entityId);
    await syncEvent.promise;
}

async function requestCampaignData(collector) {
    const syncEvent = getEntitySyncEvent(collector.entityId);
    let campaignIds = [];

    try {
        console.log('requesting campaign data for', collector.entityId);
        const missing = await getMissingDates(collector.entityId);
        const days = new Set(missing.missingDays);
        const now = Date.now();

        if (missing.needLifetime) {
            const data = await collector.getLifetimeCampaignData();
            await storeLifetimeCampaignData(collector.entityId, now, data);
        }

        if (days.size) {
            const latestDay = Math.max(...days.values());
            const latestData = await collector.getDailyCampaignData(latestDay);
            await storeDailyCampaignData(collector.entityId, latestDay, latestData);

            campaignIds = latestData.map(x => x.campaignId);
            const status = await collector.getCampaignStatus(campaignIds);
            await storeCampaignStatus(collector.entityId, now, status);
            syncEvent.set();

            days.delete(latestDay);
            await bg.parallelQueue(days.values(), async date => {
                const data = await collector.getDailyCampaignData(date);
                await storeDailyCampaignData(collector.entityId, date, data);
            });
        }
    }
    finally {
        syncEvent.set();
    }

    return campaignIds;
}

async function requestCampaignMetadata(collector, campaignId, adGroupId) {
    const asin = await collector.getCampaignAsin(campaignId, adGroupId);
    if (asin) {
        await storeCampaignMetadata(collector.entityId, campaignId, asin);
    }
}

async function requestKeywordData(collector, campaignId, adGroupId) {
    let timestamp = Date.now();

    console.log('requesting keyword data for', collector.entityId, adGroupId);
    const data = await collector.getKeywordData(campaignId, adGroupId);

    if (data && data.length) {
        await storeKeywordData(collector.entityId, adGroupId, timestamp, data);
    }
}

function storeDailyCampaignData(entityId, timestamp, data) {
    return bg.ajax(`${bg.serviceUrl}/api/campaignData/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: { aaData: data },
        contentType: 'application/json',
    });
}

function storeLifetimeCampaignData(entityId, timestamp, data) {
    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: { aaData: data },
        contentType: 'application/json',
    });
}

function storeCampaignStatus(entityId, timestamp, data) {
    return bg.ajax(`${bg.serviceUrl}/api/campaignStatus/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

async function storeKeywordData(entityId, adGroupId, timestamp, data) {
    // Chop the large keyword list into small, bite-sized chunks for easier
    // digestion on the server.
    for (const chunk of common.pageArray(data, 50)) {
        await bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}?timestamp=${timestamp}`, {
            method: 'PUT',
            jsonData: { aaData: chunk },
            contentType: 'application/json',
        });
    }
}

function getMissingDates(entityId) {
    return bg.ajax(`https://${constants.hostname}/api/campaignData/${entityId}/missingDates`, {
        method: 'GET',
        responseType: 'json',
    });
}

const getCampaignHistory = bg.cache.coMemo(function(entityId, campaignId) { // TODO: date ranges, etc.
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}/${campaignId}`, { 
        method: 'GET',
        responseType: 'json'
    });
});

const getAllCampaignData = bg.cache.coMemo(function({ entityId, startTimestamp, endTimestamp }) {
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`, { 
        method: 'GET',
        responseType: 'json'
    });
});

const getDataHistory = bg.cache.coMemo(async function({ entityId, campaignId }) { // TODO: date ranges, etc.
    const snapshots = await getCampaignHistory(entityId, campaignId);
    return common.convertSnapshotsToDeltas(snapshots);
});

const getAggregateCampaignHistory = bg.cache.coMemo(async function({ entityId, campaignIds }) {
    let aggregate = [];
    await bg.parallelQueue(campaignIds, async function(campaignId) {
        try {
            let history = await getDataHistory({ entityId, campaignId });
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

const getKeywordData = bg.cache.coMemo(async function({ domain, entityId, campaignId, adGroupId }) {
    checkEntityId(entityId);
    const url = `${bg.serviceUrl}/api/keywordData/${entityId}/${adGroupId}`;
    const opts = {
        method: 'GET',
        responseType: 'json',
    };
    let data = await bg.ajax(url, opts);


    if (!data || data.length == 0) {
        // Possibly this is the first time we've ever seen this campaign. If so,
        // let's query Amazon and populate our own servers, and then come back.
        // This is very slow but should usually only happen once.

        for (const collector of [spCm(domain, entityId), spRta(domain, entityId)]) {
            try {
                await requestKeywordData(collector, campaignId, adGroupId);
                data = await bg.ajax(url, opts);
                break;
            }
            catch (ex) {
                ga.merror(ex, `context: domain ${domain}, entityId ${entityId}, collector ${collector.name}`);
            }
        }
    }

    return data;
});

const getAggregateKeywordData = bg.cache.coMemo(function({ domain, entityId, adGroupIds }) {
    return bg.parallelQueue(adGroupIds, async function(adGroupId) {
        try {
            return await getKeywordData({ domain, entityId, adGroupId });
        }
        catch (ex) {
            if (bg.handleServerErrors(ex) == 'notAllowed') {
                // swallow this
            }
            throw ex;
        }
    });
});

function storeCampaignMetadata(entityId, campaignId, asin) {
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/campaignMetadata/${entityId}/${campaignId}`, {
        method: 'PUT',
        jsonData: { asin },
    });
}

function storeAdGroupMetadata({ entityId, adGroupId, campaignId }) {
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/adGroupMetadata/${entityId}/${adGroupId}`, {
        method: 'PUT',
        jsonData: { campaignId },
    });
}

function getAdGroups(entityId) {
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/adGroups/${entityId}`, {
        method: 'GET',
        responseType: 'json',
    });
}

async function updateKeyword({ domain, entityId, keywordIdList, operation, dataValues }) {
    // TODO: the parameters to the Amazon API imply that you can pass more than
    // 1 keyword at a time, but testing this shows that doing so just generates
    // an error. So we do it the stupid way instead, with a loop.
    const timestamp = Date.now();

    const successes = [];
    await bg.parallelQueue(keywordIdList, async function(id) {
        const response = await bg.ajax(`https://${domain}/api/sponsored-products/updateKeywords/`, {
            method: 'POST',
            formData: Object.assign({operation, entityId, keywordIds: id}, dataValues),
            responseType: 'json',
        });
        if (response.success) {
            successes.push(id);
        }
    });

    for (const page of common.pageArray(successes, 50)) {
        await bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}?timestamp=${timestamp}`, {
            method: 'PATCH',
            jsonData: { operation, dataValues, keywordIds: page },
            responseType: 'json',
        });
    }

    if (successes.length)
        getKeywordData.clear();

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
    storeAdGroupMetadata,
    updateKeyword,
};
