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

    return {
        name: 'rta',
        domain,
        entityId,
        getDailyCampaignData,
        getLifetimeCampaignData,
        getCampaignStatus,
        getAdGroupId,
    };
};
