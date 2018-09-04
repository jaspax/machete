const bg = require('./common.js');
const _ = require('lodash');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const spData = require('../common/sp-data.js');
const moment = require('frozen-moment');
require('moment-timezone');

const entityDailySyncEvent = {};

function checkEntityId(entityId) {
    if (bg.isUnset(entityId)) {
        throw new Error('invalid entityId=' + entityId);
    }
}

function mkEvent(tag) {
    const event = {};
    console.log('Created event', tag);
    event.promise = new Promise((resolve, reject) => {
        event.set = val => {
            console.log('Set event', tag);
            resolve(val);
            event.set = () => { /* ignore multiple sets */ };
        };
        event.error = e => {
            console.log('Error event', tag);
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
        try {
            const campaignIds = await requestCampaignData(domain, entityId);
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
                    adGroupId = await findAdGroupId(domain, entityId, campaignId);
                }

                if (adGroupId) {
                    if (!(summary && summary.asin)) {
                        await requestCampaignMetadata(domain, entityId, campaignId, adGroupId);
                    }
                    await requestKeywordData({ domain, entityId, campaignId, adGroupId });
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
    if (deferredException) {
        throw deferredException;
    }
}

async function findAdGroupId(domain, entityId, campaignId) {
    let html = await bg.ajax(`https://${domain}/rta/campaign/?entityId=${entityId}&campaignId=${campaignId}`, {
        method: 'GET',
        responseType: 'text'
    });
    const template = document.createElement('template');
    template.innerHTML = html;
    let adGroupId = spData.getAdGroupIdFromDOM(template.content);

    if (!adGroupId) {
        // campaignId fixup since the format changed
        const fixedId = campaignId.replace(/^AX/, 'A');
        html = await bg.ajax(`https://${domain}/cm/sp/campaigns/${fixedId}?entityId=${entityId}`, {
            method: 'GET',
            responseType: 'text'
        });
        template.innerHTML = html;
        adGroupId = spData.getAdGroupIdFromDOM(template.content);
    }

    if (adGroupId) {
        await storeAdGroupMetadata({ entityId, adGroupId, campaignId });
    }

    return adGroupId;
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

async function requestCampaignDataRta({ domain, entityId, date }) {
    const data = await bg.ajax(`https://${domain}/api/rta/campaigns`, {
        method: 'GET',
        queryData: {
            entityId,
            status: 'Customized',
            reportStartDate: date,
            reportEndDate: date,
        },
        responseType: 'json',
    });

    for (const campaigns of common.pageArray(data.aaData, 100)) {
        await storeDailyCampaignData(entityId, date, { aaData: campaigns });
    }

    return data;
}

async function requestCampaignDataCm({ domain, entityId, date }) {
    const utcDay = moment(date).tz('UTC');
    let allData = [];
    const data = await bg.ajax(`https://${domain}/cm/api/campaigns`, {
        method: 'POST',
        queryData: { entityId },
        jsonData: {
            pageOffset: 0,
            pageSize: 100,
            sort: { order: "DESC", field: "CAMPAIGN_NAME" },
            period: "CUSTOM",
            startDateUTC: utcDay.startOf('day').valueOf(),
            endDateUTC: utcDay.endOf('day').valueOf(),
            filters: [{ field: "CAMPAIGN_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false }],
            interval: "SUMMARY",
            programType: "SP",
            fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"], 
            queries: []
        },
        responseType: 'json'
    });

    allData = allData.concat(data.campaigns);
    return { aaData: allData };
}

function requestLifetimeCampaignDataRta({ domain, entityId }) {
    return bg.ajax(`https://${domain}/api/rta/campaigns`, {
        method: 'GET',
        queryData: {
            entityId,
            status: 'Lifetime',
        },
        responseType: 'json',
    });
}

async function requestLifetimeCampaignDataCm({ domain, entityId }) {
    let allData = [];
    const data = await bg.ajax(`https://${domain}/cm/api/campaigns`, {
        method: 'POST',
        queryData: { entityId },
        jsonData: {
            pageOffset: 0,
            pageSize: 100,
            sort: { order: "DESC", field: "CAMPAIGN_NAME" },
            period: "LIFETIME",
            startDateUTC: 1,
            endDateUTC: moment().valueOf(),
            filters: [{ field: "CAMPAIGN_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false }],
            interval: "SUMMARY",
            programType: "SP",
            fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"], 
            queries: []
        },
        responseType: 'json'
    });

    allData = allData.concat(data.campaigns);
    return { aaData: allData };
}

function requestCampaignDataPoly({ domain, entityId, date }) {
    try {
        return requestCampaignDataCm({ domain, entityId, date });
    }
    catch (ex) {
        console.error(ex);
        return requestCampaignDataRta({ domain, entityId, date });
    }
}

function requestLifetimeCampaignDataPoly({ domain, entityId }) {
    try {
        return requestLifetimeCampaignDataCm({ domain, entityId });
    }
    catch (ex) {
        console.error(ex);
        return requestLifetimeCampaignDataRta({ domain, entityId });
    }
}

async function requestCampaignData(domain, entityId) {
    checkEntityId(entityId);
    const syncEvent = getEntitySyncEvent(entityId);

    console.log('requesting campaign data for', entityId);
    const missing = await getMissingDates(entityId);
    const days = new Set(missing.missingDays);
    let campaignIds = [];

    try {
        if (days.size) {
            const latestDay = Math.max(...days.values());
            const latestData = await requestCampaignDataPoly({ domain, entityId, date: latestDay });
            campaignIds = latestData.aaData.map(x => x.id || x.campaignId);
            if (latestData.aaData.length && !(latestData.aaData[0].state && latestData.aaData[0].status))
                await requestCampaignStatus(domain, entityId, campaignIds, Date.now());
            syncEvent.set();

            days.delete(latestDay);
            await bg.parallelQueue(Array.from(days.values()).map(x => ({ domain, entityId, date: x })), requestCampaignDataPoly);
        }
    }
    finally {
        syncEvent.set();
    }

    if (missing.needLifetime) {
        const data = await requestLifetimeCampaignDataPoly({ domain, entityId });
        await storeLifetimeCampaignData(entityId, Date.now(), data);
    }

    return campaignIds;
}

async function requestCampaignStatus(domain, entityId, campaignIds, timestamp) {
    checkEntityId(entityId); 

    // Chop the campaignId list into bite-sized chunks
    for (const chunk of common.pageArray(campaignIds, 20)) {
        const data = await bg.ajax(`https://${domain}/api/rta/campaign-status`, {
            method: 'GET',
            queryData: {
                entityId, 
                campaignIds: chunk.join(','),
            },
            responseType: 'json',
        });

        await storeStatus(entityId, timestamp, data);
    }
}

async function requestCampaignMetadata(domain, entityId, campaignId, adGroupId) {
    const data = await bg.ajax(`https://${domain}/api/sponsored-products/getAdGroupAdList`, {
        method: 'POST',
        formData: {
            entityId, 
            adGroupId,
            status: 'Lifetime',
        },
        responseType: 'json',
    });

    if (data.message) {
        ga.mga('event', 'error-handled', 'asin-query-failure', `${adGroupId}: ${data.message}`);
        return;
    }

    /* In principle it looks like this response can contain multiple ad groups,
     * but in practice that doesn't seem to happen on AMS, so we only track the
     * one.
     */
    const asin = _.get(data, 'aaData[0].asin');
    if (asin) {
        await storeCampaignMetadata(entityId, campaignId, asin);
    }
}

async function requestKeywordData({ domain, entityId, campaignId, adGroupId }) {
    checkEntityId(entityId);

    let timestamp = Date.now();
    let data = [];

    console.log('requesting keyword data for', entityId, adGroupId);
    const response = await bg.ajax(`https://${domain}/api/sponsored-products/getAdGroupKeywordList`, {
        method: 'POST',
        formData: {
            entityId, 
            adGroupId,
            status: 'Lifetime',
        },
        responseType: 'json',
    });

    if (response.message) {
        ga.mga('event', 'error-handled', 'keyword-data-failure', `${adGroupId}: ${data.message}`);
        if (campaignId) {
            // attempt the alternate data api path
            data = await requestKeywordDataPaged(domain, entityId, campaignId, adGroupId);
        }
    }
    else {
        data = response.aaData;
    }

    if (data && data.length) {
        await storeKeywordData(entityId, adGroupId, timestamp, data);
    }
}

async function requestKeywordDataPaged(domain, entityId, campaignId, adGroupId) {
    const pageSize = 100;
    let currentPage = 0;
    let totalRecords = 0;
    let allData = [];

    // disgusting fixup for campaignId -- WHY DID THEY CREATE TWO DIFFERENT
    // FORMATS I AM GOING INSANE
    campaignId = campaignId.replace(/^AX/, 'A');

    do {
        const data = await bg.ajax(`https://${domain}/cm/api/sp/campaigns/${campaignId}/adgroups/${adGroupId}/keywords?entityId=${entityId}`, {
            method: 'POST',
            responseType: 'json',
            jsonData: {
                "startDateUTC": 1,
                "endDateUTC": Date.now(),
                "pageOffset": currentPage, 
                "pageSize": pageSize, 
                "sort": null, 
                "period": "LIFETIME", 
                "filters": [{"field": "KEYWORD_STATE", "operator": "EXACT", "values": ["ENABLED", "PAUSED"], "not": false}], 
                "interval": "SUMMARY", 
                "programType": "SP", 
                "fields": ["KEYWORD_STATE", "KEYWORD", "KEYWORD_MATCH_TYPE", "KEYWORD_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS", "KEYWORD_BID"], 
                "queries": []
            },
        });
                             
        if (!data)
            break;

        allData = allData.concat(data.keywords);
        totalRecords = data.summary.numberOfRecords;
        currentPage++;
    }
    while (currentPage * pageSize < totalRecords);

    return allData;
}

function storeDailyCampaignData(entityId, timestamp, data) {
    return bg.ajax(`${bg.serviceUrl}/api/campaignData/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

function storeLifetimeCampaignData(entityId, timestamp, data) {
    return bg.ajax(`${bg.serviceUrl}/api/data/${entityId}?timestamp=${timestamp}`, {
        method: 'PUT',
        jsonData: data,
        contentType: 'application/json',
    });
}

function storeStatus(entityId, timestamp, data) {
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
        await requestKeywordData({ domain, entityId, campaignId, adGroupId });
        data = await bg.ajax(url, opts);
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
