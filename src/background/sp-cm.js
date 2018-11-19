const _ = require('lodash');
const moment = require('frozen-moment');
require('moment-timezone');

const bg = require('./common.js');
const spData = require('../common/sp-data.js');

module.exports = function(domain, entityId) {
    const latestCampaignData = {
        timestamp: 0,
        data: [],
    };

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
        const pageSize = 100;
        let pageOffset = 0;
        let accum = [];

        let data = null;
        do {
            data = await reqfn(pageOffset, pageSize);
            accum = accum.concat(data.campaigns || data.keywords);
            pageOffset++;
        } while (pageOffset < data.summary.maxPageNumber);

        return accum;
    }

    async function probe() {
            const campaigns = await getLifetimeCampaignData();
            if (!campaigns.length)
                return true; // I guess?

            const campaign = campaigns[0];
            await bg.ajax(`https://${domain}/cm/sp/campaigns/${campaign.id}`, {
                method: 'GET',
                queryData: { entityId },
            });
            return true;
    }

    async function probeKeywordUpdate({ operation, keyword, dataValues }) {
        const result = await updateKeywords({ operation, dataValues, keywords: [keyword] });
        return result.ok.length == 1;
    }

    async function getDailyCampaignData(date) {
        const utcDay = moment(date).tz('UTC');
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
                filters: [{ field: "CAMPAIGN_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false }],
                interval: "SUMMARY",
                programType: "SP",
                fields: ["CAMPAIGN_NAME", "CAMPAIGN_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS"], 
                queries: []
            },
            responseType: 'json'
        }));

        allData.forEach(x => x.campaignId = x.id);

        if (date > latestCampaignData.timestamp) {
            latestCampaignData.timestamp = date;
            latestCampaignData.data = allData;
        }

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
                filters: [{ field: "CAMPAIGN_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false }],
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

    function getCampaignStatus() {
        const obj = {};
        for (const item of latestCampaignData.data) {
            obj[item.campaignId] = { stateName: item.state, statusName: item.status };
        }
        return obj;
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

    async function getKeywordData(campaignId, adGroupId) {
        const allData = await requestDataPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/sp/campaigns/${formatId(campaignId)}/adgroups/${formatId(adGroupId)}/keywords`, {
            method: 'POST',
            responseType: 'json',
            queryData: { entityId },
            jsonData: {
                startDateUTC: 1,
                endDateUTC: moment().valueOf(),
                pageOffset,
                pageSize,
                sort: null, 
                period: "LIFETIME", 
                filters: [{ field: "KEYWORD_STATE", operator: "EXACT", values: ["ENABLED", "PAUSED"], not: false}], 
                interval: "SUMMARY", 
                programType: "SP", 
                fields: ["KEYWORD_STATE", "KEYWORD", "KEYWORD_MATCH_TYPE", "KEYWORD_ELIGIBILITY_STATUS", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ORDERS", "SALES", "ACOS", "KEYWORD_BID"], 
                queries: []
            },
        }));
                                 
        return allData;
    }

    async function updateKeywords({ keywords, operation, dataValues }) {
        const result = { ok: [], fail: [] };

        const keywordsByAdGroup = _.groupBy(keywords, 'adGroupId');
        await bg.parallelQueue(Object.keys(keywordsByAdGroup), async adGroupId => {
            const list = keywordsByAdGroup[adGroupId];
            try {
                const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/keywords`, {
                    method: 'PATCH',
                    queryData: { entityId },
                    jsonData: list.map(kw => {
                        const item = { id: formatId(kw.id), programType: "SP" };
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
                console.error(ex);
                result.fail.push(...list);
            }
        });

        return result;
    }

    async function addKeywords({ keywords, adGroupId, bid }) {
        const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/keyword`, {
            method: 'POST',
            queryData: { entityId },
            jsonData: { keywords: keywords.map(kw => ({ keyword: kw, matchType: "BROAD", bid: { millicents: bid * 100000, currencyCode } })) },
            responseType: 'json',
        });

        return {
            ok: response.succeededKeywords.map(kw => spData.stripPrefix(kw.id)),
            fail: response.failedKeywords.map(kw => spData.stripPrefix(kw.id)),
        };
    }

    return {
        name: 'cm',
        domain,
        entityId,
        probe,
        probeKeywordUpdate,
        getDailyCampaignData,
        getLifetimeCampaignData,
        getCampaignStatus,
        getAdGroupId,
        getCampaignAsin,
        getKeywordData,
        updateKeywords,
        addKeywords
    };
};
