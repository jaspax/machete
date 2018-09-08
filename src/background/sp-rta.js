const _ = require('lodash');

const ga = require('../common/ga.js');
const bg = require('./common.js');
const common = require('../common/common.js');
const spData = require('../common/sp-data.js');

module.exports = function(domain, entityId) {
    async function getDailyCampaignData(date) {
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
        return data.aaData;
    }

    async function getLifetimeCampaignData() {
        const data = await bg.ajax(`https://${domain}/api/rta/campaigns`, {
            method: 'GET',
            queryData: {
                entityId,
                status: 'Lifetime',
            },
            responseType: 'json',
        });
        return data.aaData;
    }

    async function getCampaignStatus(campaignIds) {
        const allStatus = {};

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

            Object.assign(allStatus, data);
        }

        return allStatus;
    }

    async function getAdGroupId(campaignId) {
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
        return adGroupId;
    }

    async function getCampaignAsin(campaignId, adGroupId) {
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
            return null;
        }

        /* In principle it looks like this response can contain multiple ad groups,
         * but in practice that doesn't seem to happen on AMS, so we only track the
         * one.
         */
        return _.get(data, 'aaData[0].asin');
    }

    async function getKeywordData(campaignId, adGroupId) {
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
            ga.mga('event', 'error-handled', 'keyword-data-failure', `${adGroupId}: ${response.message}`);
        }

        return response.aaData || [];
    }

    return {
        name: 'rta',
        domain,
        entityId,
        getDailyCampaignData,
        getLifetimeCampaignData,
        getCampaignStatus,
        getAdGroupId,
        getCampaignAsin,
        getKeywordData,
    };
};
