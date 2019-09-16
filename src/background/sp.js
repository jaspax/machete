const bg = require('./common.js');
const _ = require('lodash');
const ga = require('../common/ga.js');
const spData = require('../common/sp-data.js');

const spCm = require('./sp-cm.js');
const spRta = require('./sp-rta.js');

const collectorCache = {};

async function getCollector(domain, entityId, scope = 'general') {
    const cacheTag = `${entityId}:${scope}`;
    if (collectorCache[cacheTag]) {
        return collectorCache[cacheTag];
    }

    let collector = null;
    const errors = [];
    for (const c of [spCm(domain, entityId), spRta(domain, entityId)]) {
        try {
            await c.probe();
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
            ga.debug('Probe failed for', domain, entityId, c.name, ga.errorToString(ex));
        }
    }
    if (!collector) {
        ga.warn(`No valid collectors for ${domain} ${cacheTag}: ${errors}`);
        ga.mevent('no-valid-collector', cacheTag, errors.join(', '));
        throw new Error(`No valid collectors for ${domain}`);
    }

    collectorCache[cacheTag] = collector;
    ga.debug('Using collector', domain, cacheTag, collector.name);
    ga.mevent('collector-domain', domain, collector.name);

    return collector;
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

async function updateKeyword({ entity, keywords, operation, dataValues }) {
    if (!keywords || !keywords.length) {
        return { ok: [], fail: [] };
    }
    if (typeof keywords == 'string') {
        keywords = [keywords];
    }

    const collector = await getCollector(entity.domain, entity.entityId);
    return collector.updateKeywords({ keywords, operation, dataValues });
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
