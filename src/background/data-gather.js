const _ = require('lodash');
const moment = require('moment');
require('moment-timezone');

const ga = require('../shared/ga')(process.env.ANALYTICS_ID, process.env.HOSTNAME);
const kdp = require('./kdp');
const sp = require('./sp');
const spData = require('../shared/sp-data');
const { cacheable, cacheSet, cacheGet } = require('../shared/cache');
const { handleServerErrors } = require('../shared/network');
const { stripPrefix, isPausable, isEnded, isAuthorEntity, parallelQueue } = require('../shared/data-tools');

const lastGatherKey = 'lastDataGather';

let inProgress = false;
let lastDataGather = null;

let lastStatus = {
    inProgress,
    lastDataGather,
};
const observers = [];
let statusBuffer = [];
let statusBufferTag = '';

const kdpEntity = { entityId: 'KDP', name: 'KDP' };

function writeStatus(entity, msg, error) {
    lastStatus = { 
        lastDataGather,
        inProgress, 
        entity, 
        msg,
        error
    };
    console.log('Status log:', lastStatus);
    statusBuffer.push({ timestamp: new Date(), msg, error });
    observers.forEach(x => {
        try {
            x.dataGatherStatus(lastStatus);
        }
        catch (ex) {
            ga.merror(ex);
        }
    });
}

function writeError(entity, error) {
    error.handled = handleServerErrors(error, `sync ${JSON.stringify(entity)}`);
    if (!error.handled) {
        ga.merror(error);
    }
    writeStatus(entity, `Error getting data from ${entity.name}`, error);
}

function startStatusBuffer(entity) {
    statusBufferTag = entity.entityId;
    statusBuffer = [{ timestamp: new Date(), beginEntity: entity }];
}

function endStatusBuffer() {
    ga.revent('clientLog', { tag: statusBufferTag, messages: statusBuffer.map(JSON.stringify) });
    statusBuffer = [];
    statusBufferTag = '';
}

async function dataGather(entities, currentEntity) { // eslint-disable-line max-statements
    if (inProgress) {
        console.log('Ignoring data sync while sync is in progress');
        return;
    }
    inProgress = true;
    lastDataGather = await cacheGet(lastGatherKey);

    try {
        // if we are responding to a client request, always sync that entityId first
        if (currentEntity) {
            entities = _.uniqBy([currentEntity, ...entities], 'entityId');
        }
        entities = entities.filter(x => x && x.entityId); // sanity check, in case we somehow have a bad entity being pushed down

        await innerDataGather(entities);
        lastDataGather = new Date();
        await cacheSet(lastGatherKey, lastDataGather);
    }
    finally {
        inProgress = false;
        writeStatus(null, "Finished!");
    }
}

function addDataGatherObserver(obs) {
    const i = observers.indexOf(obs);
    if (i < 0)
        observers.push(obs);
    obs.dataGatherStatus(lastStatus);
}

function removeDataGatherObserver(obs) {
    const i = observers.indexOf(obs);
    if (i >= 0)
        observers.splice(i, 1);
}

async function innerDataGather(entities) {
    console.log('dataGather', entities);
    if (await kdp.hasPermission()) {
        try {
            startStatusBuffer(kdpEntity);
            await dataGatherKdp();
        }
        catch (ex) {
            writeError(kdpEntity, ex);
        }
        finally {
            endStatusBuffer();
        }
    }

    for (const entity of entities) {
        await dataGatherEntity(entity);
    }
}

const dataGatherEntity = cacheable(async function(entity) {
    if (isAuthorEntity(entity.entityId)) {
        return true;
    }
    try {
        startStatusBuffer(entity);
        if (!(entity.entityId && entity.domain)) {
            writeStatus(entity, 'Cannot sync incomplete entity info: ' + JSON.stringify(entity));
            return false;
        }

        const lifetimeData = await syncCampaignData(entity);
        await syncPortfolios(entity);

        const summaries = await spData.getCampaignSummaries.force(entity.entityId);
        await parallelQueue(lifetimeData, async function(campaignData) {
            const campaignId = stripPrefix(campaignData.campaignId);
            let summary = summaries.find(x => x.campaignId == campaignId);
            if (!summary) {
                summary = {
                    campaignId,
                    name: campaignData.name
                };
            }

            // TODO: task #252, don't use this check
            if ((!summary.programType || summary.programType == 'SP') && (summary.campaignId[0] != 'C')) {
                const adGroupId = summary.adGroupId || await syncAdGroupId(entity, summary);
                if (adGroupId) {
                    if (!summary.asin) {
                        await syncCampaignMetadata(entity, summary, adGroupId);
                    }

                    if (shouldSyncKeywords(summary)) {
                        await syncKeywordData(entity, summary, adGroupId);
                    }
                }
            }
        });
        return true;
    }
    catch (ex) {
        writeError(entity, ex);
    }
    finally {
        endStatusBuffer();
    }

    return false;
}, { name: 'dataGatherEntity', expireHours: 8, defaultValue: false });

function shouldSyncKeywords(summary) {
    if (!summary.latestKeywordTimestamp)
        return true;
    if (isPausable(summary))
        return true;
    if (isEnded(summary) && moment(summary.endDate).isAfter(summary.latestKeywordTimestamp))
        return true;
    return false;
}

const dataGatherKdp = cacheable(async function() {
    writeStatus(kdpEntity, `Finding ASINs in your account`);
    const time = Date.now();
    const asins = await kdp.requestAsins(time);
    await parallelQueue(asins, async asinArray => {
        let asin = null;
        try {
            for (const item of asinArray) {
                // valid ASINs are either Bxxxxxxxxx or 10-digit integers
                if (item[0] != 'B' && isNaN(parseFloat(item[0])))
                    continue;
                asin = item.substring(0, 10);
                break;
            }
            if (!asin) {
                ga.mevent('kdp-warning', 'asin-unknown-format', JSON.stringify(asinArray));
                return;
            }

            writeStatus(kdpEntity, `Requesting sales data for ASIN ${asin}`);

            const sales = await kdp.requestSalesData(time, asinArray);
            const ku = await kdp.requestKuData(time, asinArray);

            await spData.storeKdpData(asin, sales, ku);
        }
        catch (ex) {
            const asinStr = asin || JSON.stringify(asinArray);
            writeStatus(kdpEntity, `Error getting sales data for ASIN ${asinStr}`, ex);
        }
    });
}, { name: 'dataGatherKdp', expireHours: 6, defaultValue: false });

async function syncCampaignData(entity) {
    let lifetimeData = [];

    const missing = await spData.getMissingDates(entity.entityId);
    writeStatus(entity, `Going to sync ${missing.needLifetime ? 'lifetime campaign stats and' : 'only'} ${missing.missingDays.length} previous days`);
    const days = new Set(missing.missingDays);

    try {
        if (missing.needLifetime) {
            writeStatus(entity, 'Getting current lifetime campaign stats');
            const now = Date.now();
            lifetimeData = await sp.requestLifetimeCampaignData(entity);
            await spData.storeLifetimeCampaignData(entity.entityId, now, lifetimeData);
        }

        if (days.size) {
            await parallelQueue(days.values(), async date => {
                const timestamp = moment.tz(date, 'UTC').startOf('day').valueOf();
                if (isNaN(timestamp)) {
                    writeStatus(entity, `Date ${date} generates invalid timestamp ${timestamp}`);
                    return;
                }

                writeStatus(entity, `Getting daily campaign stats for ${moment(date).format('MMM DD')}`);
                const data = await sp.requestDailyCampaignData(entity, date);
                await spData.storeDailyCampaignData(entity.entityId, timestamp, data);
            });
        }
    }
    catch (ex) {
        // Errors here shouldn't block us from attempting to get keyword data,
        // so we swallow and log this.
        ga.merror(ex);
    }
    return lifetimeData;
}

async function syncPortfolios(entity) {
    writeStatus(entity, 'Getting portfolios');
    const portfolios = await sp.requestPortfolios(entity);
    if (portfolios.length)
        await spData.storePortfolios(entity.entityId, portfolios);
    return portfolios;
}

async function syncAdGroupId(entity, summary) {
    writeStatus(entity, `Getting ad groups for campaign ${summary.name}`);
    const adGroupId = stripPrefix(await sp.requestAdGroupId(entity, summary.campaignId));
    if (adGroupId)
        await spData.storeAdGroupMetadata(entity.entityId, adGroupId, summary.campaignId);
    return adGroupId;
}

async function syncCampaignMetadata(entity, summary, adGroupId) {
    writeStatus(entity, `Getting product data for campaign ${summary.name}`);
    const asin = await sp.requestCampaignAsin(entity, summary.campaignId, adGroupId);
    if (asin) {
        await spData.storeCampaignMetadata(entity.entityId, summary.campaignId, asin);
    }
    return asin;
}

async function syncKeywordData(entity, summary, adGroupId) {
    if (!(summary.campaignId && adGroupId)) {
        ga.merror(`missing campaignId or adGroupId: entityId ${entity.entityId}, campaignId ${summary.campaignId}, adGroupId ${summary.adGroupId}`);
        return;
    }

    if (summary.campaignId[0] == 'C') {
        // this is a product display ad, which doesn't have keywords. Skip it.
        console.log('Skipping requestKeywordData for', summary.campaignId, adGroupId, 'because of wrong ad type');
        return;
    }
    
    writeStatus(entity, `Getting keyword data for campaign ${summary.name}`);
    const now = Date.now();
    const data = await sp.requestKeywordData(entity, summary.campaignId, stripPrefix(adGroupId));
    if (data && data.length) {
        await spData.storeKeywordData(entity.entityId, adGroupId, now, data);
    }
}

module.exports = {
    addDataGatherObserver,
    dataGather,
    dataGatherEntity,
    removeDataGatherObserver,
    syncKeywordData,
};
