const _ = require('lodash');

const ga = require('../common/ga.js');
const bg = require('./common.js');
const common = require('../common/common.js');
const spData = require('../common/sp-data.js');

module.exports = function(domain, entityId) {
    function formatId(id) {
        if (id.match(/^A/)) {
            throw new Error('Preformatted ID? : ' + id);
        }
        if (id.match(/^C/))
            return 'A' + id;
        return 'AX' + id;
    }

    async function probe() {
        const campaigns = await getLifetimeCampaignData();
        if (!campaigns.length)
            return true; // I guess?

        const campaign = campaigns[0];
        await bg.ajax(`https://${domain}/rta/campaign/?entityId=${entityId}&campaignId=${campaign.campaignId}`, {
            method: 'GET',
            responseType: 'text'
        });
        return true;
    }

    async function probeKeywordUpdate({ operation, keyword, dataValues }) {
        const result = await updateKeywords({ operation, dataValues, keywords: [keyword] });
        return result.ok.length == 1;
    }

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
        let html = await bg.ajax(`https://${domain}/rta/campaign/?entityId=${entityId}&campaignId=${formatId(campaignId)}`, {
            method: 'GET',
            responseType: 'text'
        });
        const template = document.createElement('template');
        template.innerHTML = html;
        return spData.getAdGroupIdFromDOM(template.content);
    }

    async function getCampaignAsin(campaignId, adGroupId) {
        const data = await bg.ajax(`https://${domain}/api/sponsored-products/getAdGroupAdList`, {
            method: 'POST',
            formData: {
                entityId, 
                adGroupId: formatId(adGroupId),
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
                adGroupId: formatId(adGroupId),
                status: 'Lifetime',
            },
            responseType: 'json',
        });

        if (response.message) {
            ga.mga('event', 'error-handled', 'keyword-data-failure', `${adGroupId}: ${response.message}`);
        }

        return response.aaData || [];
    }

    async function updateKeywords({ keywords, operation, dataValues }) {
        const result = { ok: [], fail: [] };

        // the parameters to the Amazon API imply that you can pass more than 1
        // keyword at a time, but testing this shows that doing so just
        // generates an error. So we do it the stupid way instead, with a loop.
        await bg.parallelQueue(keywords, async function(kw) {
            try {
                const response = await bg.ajax(`https://${domain}/api/sponsored-products/updateKeywords/`, {
                    method: 'POST',
                    formData: Object.assign({operation, entityId, keywordIds: formatId(kw.id)}, dataValues),
                    responseType: 'json',
                });
                if (response.success) {
                    result.ok.push(kw.id);
                }
                else {
                    result.fail.push(kw.id);
                }
            }
            catch (ex) {
                console.error(ex);
                result.fail.push(kw.id);
            }
        });

        return result;
    }

    async function addKeywords({ keywords, adGroupId }) {
        const rv = { fail: [], ok: [] };
        const bidGroups = _.groupBy(keywords, 'bid');
        await bg.parallelQueue(Object.keys(bidGroups), async bid => {
            try {
                const response = await bg.ajax(`https://${domain}/api/sponsored-products/keywordBulkUpload/`, {
                    method: 'POST',
                    formData: {
                        keywords: JSON.stringify(bidGroups[bid].map(item => ({ keyword: item.keyword, match: "BROAD" }))),
                        bid,
                        adGroupId: formatId(adGroupId),
                        entityId,
                    },
                    responseType: 'json',
                });

                if (response.success) {
                    rv.ok.push(...response.validKeywords.map(kw => spData.stripPrefix(kw.id)));
                    rv.fail.push(...response.invalidKeywords);
                }
                else {
                    throw new Error(response.message);
                }
            }
            catch (ex) {
                rv.fail.push(...bidGroups[bid].map(kw => ({ errorMessage: ex.message, keyword: kw})));
            }
        });

        return rv;
    }

    return {
        name: 'rta',
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
        addKeywords,
    };
};
