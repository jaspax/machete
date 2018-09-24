const _ = require('lodash');
const moment = require('frozen-moment');
require('moment-timezone');

const bg = require('./common.js');
const common = require('../common/common.js');

module.exports = function(domain, entityId) {
    const latestCampaignData = {
        timestamp: 0,
        data: [],
    };

    function formatId(id) {
        if (id.match(/^A/)) {
            throw new Error('Preformatted ID? : ' + id);
        }
        return 'A' + id;
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
        try {
            const campaigns = await getLifetimeCampaignData();
            const campaign = campaigns[0];
            await bg.ajax(`https://${domain}/cm/sp/campaigns/${campaign.id}`, {
                method: 'GET',
                queryData: { entityId },
            });
            return true;
        }
        catch (ex) {
            const error = bg.handleServerErrors(ex, 'cm probe');
            return error == 'amazonNotLoggedIn';
        }
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

    async function updateKeywords({ keywordIdList, operation, dataValues }) {
        let successes = [];

        const keywordsByAdGroup = _.groupBy(keywordIdList, 'adGroupId');
        for (const adGroupId of Object.keys(keywordsByAdGroup)) {
            const list = keywordsByAdGroup[adGroupId];
            for (const chunk of common.pageArray(list, 50)) {
                const response = await bg.ajax(`https://${domain}/cm/api/sp/adgroups/${formatId(adGroupId)}/keywords`, {
                    method: 'PATCH',
                    queryData: { entityId },
                    jsonData: chunk.map(kw => {
                        const item = { id: formatId(kw.id), programType: "SP" };
                        if (operation == 'PAUSE')
                            item.state = 'PAUSED';
                        if (operation == 'ENABLE')
                            item.state = 'ENABLED';
                        if (operation == 'UPDATE')
                            item.bid = { bid: dataValues.bid };
                        return item;
                    }),
                    responseType: 'json',
                });

                successes = successes.concat(response.updatedKeywords);
            }
        }

        return successes;
    }

    return {
        name: 'cm',
        domain,
        entityId,
        probe,
        getDailyCampaignData,
        getLifetimeCampaignData,
        getCampaignStatus,
        getAdGroupId,
        getCampaignAsin,
        getKeywordData,
        updateKeywords,
    };
};
