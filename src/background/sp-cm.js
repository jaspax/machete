const moment = require('frozen-moment');
require('moment-timezone');

const bg = require('./common.js');
const spData = require('../common/sp-data.js');

module.exports = function(domain, entityId) {
    const latestCampaignData = {
        timestamp: 0,
        data: [],
    };

    async function requestCampaignsPaged(reqfn) {
        const pageSize = 100;
        let pageOffset = 0;
        let accum = [];

        let data = null;
        do {
            data = await reqfn(pageOffset, pageSize);
            accum = accum.concat(data.campaigns);
            pageOffset++;
        } while (pageOffset < data.summary.maxPageNumber);

        return accum;
    }

    async function getDailyCampaignData(date) {
        const utcDay = moment(date).tz('UTC');
        const allData = await requestCampaignsPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/campaigns`, {
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

        allData.forEach(x => x.campaignId = spData.rtaId(x.id));

        if (date > latestCampaignData.timestamp) {
            latestCampaignData.timestamp = date;
            latestCampaignData.data = allData;
        }

        return allData;
    }

    async function getLifetimeCampaignData() {
        const allData = await requestCampaignsPaged((pageOffset, pageSize) => bg.ajax(`https://${domain}/cm/api/campaigns`, {
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

        allData.forEach(x => x.campaignId = spData.rtaId(x.id));
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
        const page = await bg.ajax(`https://${domain}/cm/sp/campaigns/${spData.cmId(campaignId)}`, {
            method: 'GET',
            queryData: { entityId },
        });

        const match = page.match(/adGroupId *: *"(\w+)"/i);
        if (!match)
            return null;
        return match[1];
    }

    return {
        name: 'cm',
        domain,
        entityId,
        getDailyCampaignData,
        getLifetimeCampaignData,
        getCampaignStatus,
        getAdGroupId,
    };
};
