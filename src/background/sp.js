const bg = require('./common.js');
const _ = require('lodash');
const ga = require('../common/ga.js');
const spData = require('../common/sp-data.js');

const spCm = require('./sp-cm.js');
const spRta = require('./sp-rta.js');

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

async function requestLifetimeCampaignData({ entity }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.getLifetimeCampaignData();
}

async function requestDailyCampaignData({ entity, date }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.getDailyCampaignData(date);
}

async function requestAdGroupId({ entity, campaignId }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.getAdGroupId(campaignId);
}

async function requestCampaignAsin({ entity, campaignId, adGroupId }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.getCampaignAsin(campaignId, adGroupId);
}

async function requestKeywordData({ entity, campaignId, adGroupId }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.getKeywordData(campaignId, adGroupId);
}

function requestAdEntities({ domain }) {
    const collector = spCm(domain);
    return collector.getAdEntities();
}

async function updateKeyword({ domain, entityId, entity, keywords, operation, dataValues }) {
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
    
    // simultaneous compat with plugin and page. TODO: delete this later
    if (!entity) {
        entity = { domain, entityId };
    }

    const collector = await getCollector(entity.domain, entity.entityId);

    keywords.push(probeKw);
    const result = await collector.updateKeywords({ keywords, operation, dataValues });

    for (const page of bg.pageArray(result.ok, 50)) {
        await bg.ajax(`${bg.serviceUrl}/api/keywordData/${entity.entityId}?timestamp=${timestamp}`, {
            method: 'PATCH',
            jsonData: { operation, dataValues, keywordIds: page },
            responseType: 'json',
        });
    }

    return result;
}

async function addKeywords({ entity, adGroupId, keywords }) {
    const collector = await getCollector(entity.domain, entity.entityId);
    adGroupId = spData.stripPrefix(adGroupId);
    keywords = _.uniqBy(keywords, kw => kw.keyword);

    const result = await collector.addKeywords({ keywords, adGroupId });

    return result;
}

async function updateCampaigns({ entity, campaigns, operation, dataValues }) {
    if (!campaigns || !campaigns.length) {
        return { ok: [], fail: [] };
    }

    const collector = await getCollector(entity.domain, entity.entityId);
    const result = await collector.updateCampaigns({ campaigns, operation, dataValues });
    return result;
}

async function requestPortfolios({ entity }) {
    const { domain, entityId } = entity;
    const collector = await getCollector(domain, entityId);
    return collector.getPortfolios();
}

module.exports = {
    name: 'sp',
    addKeywords,
    requestAdEntities,
    requestAdGroupId,
    requestCampaignAsin,
    requestDailyCampaignData,
    requestKeywordData,
    requestLifetimeCampaignData,
    requestPortfolios,
    updateCampaigns,
    updateKeyword,
};
