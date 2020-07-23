const _ = require('lodash');
const moment = require('frozen-moment');
require('moment-timezone');

const ga = require('../common/ga');
const bg = require('./common.js');
const spData = require('../common/sp-data.js');

module.exports = function(domain, entityId) {
    const currencyCode = guessCurrencyCode();

    function formatId(id) {
        if (id.match(/^A/)) {
            throw new Error('Preformatted ID? : ' + id);
        }
        return 'A' + id;
    }

    function guessCurrencyCode() {
        // We assume (possibly wrongly) that we can predict the currency from
        // the domain.
        switch (domain) {
            case 'advertising.amazon.co.uk':
                return 'GBP';
            case 'advertising.amazon.ca':
                return 'CAD';
            case 'advertising.amazon.co.de':
            case 'advertising.amazon.co.fr':
                return 'EUR';
            case 'advertising.amazon.com':
            default:
                return 'USD';
        }
    }

    async function requestDataPaged(reqfn) {
        const pageSize = 200;

        const firstData = await reqfn(0, pageSize);
        let accum = firstData.campaigns || firstData.keywords || firstData.portfolios;

        const pages = [...Array(firstData.summary.maxPageNumber).keys()].slice(1);
        for (const pageOffset of pages) {
            const data = await reqfn(pageOffset, pageSize);
            accum = accum.concat(data.campaigns || data.keywords || data.portfolios);
        }

        return accum;
    }

    async function probe() {
        const probeCampaign = await bg.ajax(`https://${domain}/cm/api/campaigns`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: {
                pageOffset: 0,
                pageSize: 5,
                sort: { order: "DESC", field: "CAMPAIGN_NAME" },
                period: "LIFETIME",
                startDateUTC: 1,
                endDateUTC: moment().valueOf(),
                filters: [],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"],
                queries: []
            },
            responseType: 'json'
        });
        if (!probeCampaign.campaigns.length)
            return true; // I guess?

        const campaign = probeCampaign.campaigns.find(x => x.id.slice(0, 2) != 'AC');
        if (campaign) {
            await bg.ajax(`https://${domain}/cm/sp/campaigns/${campaign.id}`, {
                method: 'GET',
                queryData: { entityId },
            });
        }
        return true;
    }

    async function probeKeywordUpdate({ operation, keyword, dataValues }) {
        const result = await updateKeywords({ operation, dataValues, keywords: [keyword] });
        return result.ok.length == 1;
    }

    async function getDailyCampaignData(date) {
        const utcDay = moment.tz(date, 'UTC');
        const allData = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/campaigns`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: {
                pageOffset,
                pageSize,
                sort: { order: "DESC", field: "CAMPAIGN_NAME" },
                period: "CUSTOM",
                startDateUTC: utcDay.startOf('day').valueOf(),
                endDateUTC: utcDay.endOf('day').valueOf(),
                filters: [],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"],
                queries: []
            },
            responseType: 'json'
        }));

        allData.forEach(x => x.campaignId = x.id);

        return allData;
    }

    async function getLifetimeCampaignData() {
        const allData = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/campaigns`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: {
                pageOffset,
                pageSize,
                sort: { order: "DESC", field: "CAMPAIGN_NAME" },
                period: "LIFETIME",
                startDateUTC: 1,
                endDateUTC: moment().valueOf(),
                filters: [],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"],
                queries: []
            },
            responseType: 'json'
        }));

        allData.forEach(x => x.campaignId = x.id);
        return allData;
    }

    async function getAdGroupId(campaignId) {
        const page = await bg.ajax(`https://${domain}/cm/sp/campaigns/${formatId(campaignId)}`, {
            method: 'GET',
            queryData: { entityId },
        });

        const match = page.match(/adGroupId *: *"(\w+)"/i);
        if (!match)
            return null;
        return match[1];
    }

    async function getCampaignAsin(campaignId, adGroupId) {
        const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/ads`, {
            method: 'POST',
            responseType: 'json',
            queryData: { entityId },
            jsonData: {
                pageOffset: 0,
                pageSize: 10,
                sort: null,
                period: "LIFETIME",
                startDateUTC: 0,
                endDateUTC: moment().valueOf(),
                filters: [],
                programType: "SP",
                fields: ["AD_ASIN", "AD_SKU"]
            },
        });

        return _.get(response, 'ads[0].asin');
    }

    async function getAdEntities() {
        const html = await bg.ajax(`https://${domain}/accounts`, {
            method: 'GET',
            responseType: 'text'
        });
        const template = document.createElement('template');
        template.innerHTML = html;

        const entities = [];
        const elements = template.content.querySelectorAll("[data-entity-id]");
        for (const el of elements) {
            const entityId = el.getAttribute('data-entity-id');
            const titleEl = el.querySelector('.item-content-title');
            const name = titleEl.innerText.trim();
            entities.push({ domain, entityId, name, collector: 'cm' });
        }

        return entities;
    }

    async function getKeywordData(campaignId, adGroupId) {
        const allData = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/sp/campaigns/${formatId(campaignId)}/adgroups/${formatId(adGroupId)}/keywords`, {
            method: 'POST',
            responseType: 'json',
            queryData: { entityId },
            jsonData: {
                pageOffset,
                pageSize,
                startDateUTC: 1,
                endDateUTC: moment().valueOf(),
                period: "LIFETIME",
                sort: null,
                filters: [{ field: "KEYWORD_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false}],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["KEYWORD_STATE", "KEYWORD", "KEYWORD_MATCH_TYPE", "KEYWORD_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS", "KEYWORD_BID"],
                queries: []
            },
        }));

        return allData;
    }

    async function getDailyKeywordData(campaignId, adGroupId, date) {
        const utcDay = moment.tz(date, 'UTC');
        const allData = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/sp/campaigns/${formatId(campaignId)}/adgroups/${formatId(adGroupId)}/keywords`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: {
                pageOffset,
                pageSize,
                startDateUTC: utcDay.startOf('day').valueOf(),
                endDateUTC: utcDay.endOf('day').valueOf(),
                period: "CUSTOM",
                sort: null,
                filters: [{ field: "KEYWORD_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false}],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["KEYWORD_STATE", "KEYWORD", "KEYWORD_MATCH_TYPE", "KEYWORD_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS", "KEYWORD_BID"],
                queries: []
            },
            responseType: 'json'
        }));

        return allData;
    }

    async function updateKeywords({ keywords, operation, dataValues }) {
        const result = { ok: [], fail: [] };

        const keywordsByAdGroup = _.groupBy(keywords, 'adGroupId');
        for (const adGroupId of Object.keys(keywordsByAdGroup)) {
            const list = keywordsByAdGroup[adGroupId];
            try {
                const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/keywords`, {
                    method: 'PATCH',
                    queryData: { entityId },
                    jsonData: list.map(kw => {
                        const item = { id: formatId(kw.kwid), programType: "SP" };
                        if (operation == 'PAUSE')
                            item.state = 'PAUSED';
                        if (operation == 'ENABLE')
                            item.state = 'ENABLED';
                        if (operation == 'UPDATE')
                            item.bid = { millicents: dataValues.bid * 100000, currencyCode };
                        return item;
                    }),
                    responseType: 'json',
                });

                result.ok.push(...response.updatedKeywords.map(kw => spData.stripPrefix(kw.id)));
                result.fail.push(...response.failedKeywordIds.map(spData.stripPrefix));
            }
            catch (ex) {
                ga.merror(ex);
                result.fail.push(...list.map(kw => kw.kwid));
            }
        }

        return result;
    }

    async function updateCampaigns({ campaigns, operation, dataValues }) {
        const result = { ok: [], fail: [] };
        try {
            const response = await bg.ajax(`https://${domain}/cm/api/campaigns`, {
                method: 'PATCH',
                query: { entityId },
                jsonData: campaigns.map(x => {
                    const item = { id: formatId(x.campaignId), programType: "SP" };
                    if (operation == 'PAUSE')
                        item.state = 'PAUSED';
                    if (operation == 'ENABLE')
                        item.state = 'ENABLED';
                    if (operation == 'UPDATE')
                        item.budget = { millicents: dataValues.budget * 100000, currencyCode, budgetType: x.budgetType };
                    return item;
                }),
                responseType: 'json',
            });

            result.ok.push(...response.updatedCampaigns.map(x => spData.stripPrefix(x.id)));
            result.fail.push(...response.failedCampaigns.map(x => spData.stripPrefix(x.id)));
        }
        catch (ex) {
            ga.merror(ex);
            result.fail.push(...campaigns.map(x => x.campaignId));
        }
        return result;
    }

    async function addKeywords({ keywords, adGroupId }) {
        const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/keyword`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: { keywords: keywords.map(kw => ({ keyword: kw.keyword, matchType: kw.matchType || "BROAD", bid: { millicents: kw.bid * 100000, currencyCode } })) },
            responseType: 'json',
        });

        return {
            ok: response.succeededKeywordIds.map(spData.stripPrefix),
            fail: response.failedKeywords.map(kw => spData.stripPrefix(kw.id)),
        };
    }

    async function getPortfolios() {
        const portfolios = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/portfolios/performance`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: {
                pageOffset,
                pageSize,
                startDateUTC: 1,
                endDateUTC: moment().valueOf(),
                sort: null,
                period: "LIFETIME",
                filters: [{ "field": "CAMPAIGN_PROGRAM_TYPE", "not": false, "operator": "EXACT", "values": ["SP", "HSA"]}],
                fields: ["PORTFOLIO_NAME", "PORTFOLIO_STATUS", "PORTFOLIO_BUDGET", "PORTFOLIO_BUDGET_TYPE", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS", "NTB_ORDERS", "NTB_PERCENT_OF_ORDERS", "NTB_SALES", "NTB_PERCENT_OF_SALES"],
            },
            responseType: 'json',
        }));
        return portfolios.map(x => Object.assign(x, { id: spData.stripPrefix(x.id) }));
    }

    return {
        name: 'cm',
        addKeywords,
        domain,
        entityId,
        getAdEntities,
        getAdGroupId,
        getCampaignAsin,
        getDailyCampaignData,
        getDailyKeywordData,
        getKeywordData,
        getLifetimeCampaignData,
        getPortfolios,
        probe,
        probeKeywordUpdate,
        updateCampaigns,
        updateKeywords,
    };
};
