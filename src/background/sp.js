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

const collectorCache = {};

async function getCollectorImpl(domain, entityId, scope, probeFn) {
    const cacheTag = `${entityId}:${scope}`;
    if (collectorCache[cacheTag]) {
        return collectorCache[cacheTag];
    }

    let collector = null;
    const errors = [];
    for (const c of [spCm(domain, entityId), spRta(domain, entityId)]) {
        try {
            await probeFn(c);
            collector = c;
            break;
        }
        catch (ex) {
            const handled = bg.handleServerErrors(ex, 'sp.getCollector:' + c.name);
            if (handled == 'amazonNotLoggedIn') {
                // treat this as if it were success, then let the error
                // propagate when we try to get the real page.
                collector = c;
                break;
            }

            errors.push(`${c.name}: ${ga.errorToString(ex)}`);
            console.log('Probe failed for', domain, entityId, c.name, ga.errorToString(ex));
        }
    }
    if (!collector) {
        console.log(`No valid collectors for ${domain} ${cacheTag}: ${errors}`);
        ga.mga('event', 'no-valid-collector', cacheTag, errors.join(', '));
        throw new Error(`No valid collectors for ${domain}`);
    }

    collectorCache[cacheTag] = collector;
    console.log('Using collector', domain, cacheTag, collector.name);
    ga.mga('event', 'collector-domain', domain, collector.name);

    return collector;
}

function getCollector(domain, entityId) {
    return getCollectorImpl(domain, entityId, 'general', c => c.probe());
}

/*
function getCollectorForKeywordUpdate(domain, entityId, keywordOpts) {
    return getCollectorImpl(domain, entityId, 'keywordUpdate', c => c.probeKeywordUpdate(keywordOpts));
}
*/

async function dataGather(req) {
    ga.beginLogBuffer('sp.dataGather');
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
        if (bg.isUnset(entityId))
            continue;

        try {
            const collector = await getCollector(domain, entityId);

            // Store entity metadata locally if we have all relevant fields
            const entityMetadata = bg.setEntityId(entityId, { collector: collector.name });
            if (entityMetadata.name && entityMetadata.collector && entityMetadata.domain) {
                await storeEntityMetadata(entityMetadata);
            }

            const campaignIds = await requestCampaignData(collector);
            const adGroups = await getAdGroups(entityId);
            const summaries = await getCampaignSummaries({ entityId });

            await bg.parallelQueue(campaignIds, async function(campaignId) {
                campaignId = spData.stripPrefix(campaignId);
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
                    console.log('requesting adGroupId for', collector.entityId, campaignId);
                    adGroupId = await collector.getAdGroupId(campaignId);
                    if (adGroupId)
                        await storeAdGroupMetadata({ entityId: collector.entityId, adGroupId, campaignId });
                }

                if (adGroupId) {
                    if (!(summary && summary.asin)) {
                        await requestCampaignMetadata(collector, campaignId, spData.stripPrefix(adGroupId));
                    }
                    await requestKeywordData(collector, campaignId, spData.stripPrefix(adGroupId));
                }
            });
        }
        catch (ex) {
            if (!bg.handleServerErrors(ex, "sp.dataGather")) {
                ga.merror(ex, `context: domain ${domain}, entityId ${entityId}`);
            }
            deferredException = ex;
        }
    }

    ga.endLogBuffer();
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
    if (!(campaignId && adGroupId)) {
        ga.merror(`missing campaignId or adGroupId: entityId ${collector.entityId}, campaignId ${campaignId}, adGroupId ${adGroupId}, collector ${collector.name}`);
        return;
    }

    if (campaignId[0] == 'C') {
        // this is a product display ad, which doesn't have keywords. Skip it.
        console.log('Skipping requestKeywordData for', campaignId, adGroupId, 'because of wrong ad type');
        return;
    }

    console.log('requesting keyword data for', collector.entityId, campaignId, adGroupId);
    const data = await collector.getKeywordData(campaignId, adGroupId);

    if (data && data.length) {
        await storeKeywordData(collector.entityId, adGroupId, Date.now(), data);
    }
}

function storeDailyCampaignData(entityId, timestamp, data) {
    if (!(data && data.length))
        return Promise.resolve();

    return bg.ajax(`${bg.serviceUrl}/api/campaignData/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

function storeLifetimeCampaignData(entityId, timestamp, data) {
    if (!(data && data.length))
        return Promise.resolve();

    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
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
            jsonData: chunk,
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

        const collector = await getCollector(domain, entityId);
        try {
            await requestKeywordData(collector, campaignId, adGroupId);
            data = await bg.ajax(url, opts);
        }
        catch (ex) {
            ga.merror(ex, `context: domain ${domain}, entityId ${entityId}, campaignId ${campaignId}, adGroupId ${adGroupId}, collector ${collector.name}`);
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

function storeEntityMetadata(metadata) {
    const entityId = metadata.entityId;
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/meta/${entityId}`, {
        method: 'PUT',
        jsonData: metadata,
    });
}

function getAdGroups(entityId) {
    checkEntityId(entityId);
    return bg.ajax(`${bg.serviceUrl}/api/adGroups/${entityId}`, {
        method: 'GET',
        responseType: 'json',
    });
}

async function updateKeyword({ domain, entityId, keywords, operation, dataValues }) {
    const timestamp = Date.now();
    if (!keywords || !keywords.length) {
        return { ok: [], fail: [] };
    }
    if (typeof keywords == 'string') {
        keywords = [keywords];
    }

    const probeKw = keywords.shift();

    // We would like to use the fast path here, which is returned by
    // getCollectorForKeywordUpdate, but doing so causes failures under
    // conditions we don't entirely understand. Switching to the regular
    // collector resolves this issue for most users.
    //
    // const collector = await getCollectorForKeywordUpdate(domain, entityId, { operation, dataValues, keyword: probeKw });
    const collector = await getCollector(domain, entityId);

    keywords.push(probeKw);
    const result = await collector.updateKeywords({ keywords, operation, dataValues });

    for (const page of common.pageArray(result.ok, 50)) {
        await bg.ajax(`${bg.serviceUrl}/api/keywordData/${entityId}?timestamp=${timestamp}`, {
            method: 'PATCH',
            jsonData: { operation, dataValues, keywordIds: page },
            responseType: 'json',
        });
    }

    if (result.ok.length)
        getKeywordData.clear();
    return result;
}

async function addKeywords({ domain, entityId, campaignId, adGroupId, keywords }) {
    const collector = await getCollector(domain, entityId);
    campaignId = spData.stripPrefix(campaignId);
    adGroupId = spData.stripPrefix(adGroupId);
    keywords = _.uniqBy(keywords, kw => kw.keyword);

    const result = await collector.addKeywords({ keywords, adGroupId });
    await requestKeywordData(collector, campaignId, adGroupId);

    return result;
}

function setBrandName({ entityId, brandName }) {
    bg.setEntityId(entityId, { name: brandName });
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
    addKeywords,
    setBrandName,
};
