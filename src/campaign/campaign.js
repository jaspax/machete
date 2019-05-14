const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const spdata = require('../common/sp-data.js');
const ga = require('../common/ga.js');
const tabber = require('../components/tabber.js');

const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const BidOptimizerTab = require('../components/BidOptimizerTab.jsx');
const KeywordBulkUpdate = require('../components/KeywordBulkUpdate.jsx');

const ourTabs = [
    { label: "Keyword Analytics", activate: generateKeywordReports, insertIndex: 1 },
    { label: "Campaign History", activate: generateHistoryReports, insertIndex: 2 },
    { label: "Bid Optimizer", activate: generateBidOptimizer, insertIndex: 3 },
];

let adGroupId = null; // await the keywordDataPromise before doing this
let keywordDataPromise = null; 

if (spdata.amsPageInit()) {
    keywordDataPromise = ga.mpromise((resolve, reject) => {
        const adGroupInterval = window.setInterval(ga.mcatch(() => {
            adGroupId = spdata.getAdGroupIdFromDOM(document);
            if (adGroupId) {
                const entityId = spdata.getEntityId();
                spdata.storeAdGroupMetadata(entityId, spdata.getCampaignId(), adGroupId);
                spdata.getKeywordData(entityId, spdata.getCampaignId(), adGroupId).then(resolve, reject);
                window.clearInterval(adGroupInterval);
            }
        }), 250);
    });
}

window.setInterval(ga.mcatch(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (!campaignTabs.length) {
        if (!window.location.href.match(/\/(keywords|targeting)/))
            return;
        campaignTabs = $('.page-container > div').last();
    }

    if (campaignTabs.length && campaignTabs.find(`.machete-tab`).length == 0) {
        addCampaignTabs(campaignTabs);
    }
}), 100);

function addCampaignTabs(tabs) {
    if (tabs.prop('tagName') == 'DIV') { // new ui
        tabber(tabs, { label: 'Keyword List', active: true });
    }
    for (let tab of ourTabs) {
        tabber(tabs, tab);
    }

    // Render the bulk update control on the main keyword list
    let allTable = $('[data-e2e-id=dataTableWrapper]').children().first();
    if (!allTable.length)
        allTable = $($('.page-container .a-tab-content').first().children().get(2));
    if (allTable.find('#machete-bulk-all').length == 0) {
        keywordDataPromise.then(data => {
            // Hack ourselves into the Amazon layout
            const bulkContainer = $('<div class="a-span4 machete-kwupdate-all" id="machete-bulk-all"></div>');
            if ($('#keywordTableControls').length) {
                const first = allTable.children().first();
                first.removeClass('a-span8');
                first.addClass('a-span4');
                first.after(bulkContainer);
            }
            else {
                bulkContainer.css('float', 'left');
                allTable.prepend(bulkContainer);
            }
            generateBulkUpdate(bulkContainer, data);
        });
    }
}

function generateKeywordReports(container) {
    const tab = React.createElement(KeywordAnalyticsTab, {
        dataPromise: keywordDataPromise,
        campaignPromise: ga.mpromise(async function() {
            const allowed = await spdata.getAllowedCampaignSummaries();
            return spdata.campaignSelectOptions(allowed);
        }),
        onKeywordEnabledChange: spdata.updateKeywordStatus,
        onKeywordBidChange: spdata.updateKeywordBid,
        onKeywordCopy: spdata.copyKeywordsToCampaigns,
    });
    ReactDOM.render(tab, container[0]);
}

function generateHistoryReports(container) {
    const entityId = spdata.getEntityId();
    const campaignId = spdata.getCampaignId();
    let tabContent = React.createElement(CampaignHistoryTab, { 
        dataPromise: ga.mpromise(async function() {
            const amsData = await spdata.getCampaignHistory(entityId, campaignId);
            if (await spdata.hasKdpIntegration()) {
                const summary = await spdata.getCampaignSummary(entityId, campaignId);
                if (summary && summary.asin) {
                    const kdpData = await spdata.getKdpSalesHistory(summary.asin);
                    return spdata.calculateKnpIncome(amsData, kdpData);
                }
                return amsData;
            }
            return amsData;
        }),
    });
    ReactDOM.render(tabContent, container[0]);
}

function generateBidOptimizer(container) {
    const entityId = spdata.getEntityId();
    const campaignId = spdata.getCampaignId();

    const tabContent = React.createElement(BidOptimizerTab, {
        defaultTarget: 'acos',
        defaultTargetValue: 70,
        keywordPromiseFactory: (target, options) => ga.mpromise(async function() {
            if (!['acos', 'sales'].includes(target.target))
                throw new Error("Don't know how to optimize for " + target.target);

            const campaignSummary = await spdata.getCampaignSummary(entityId, campaignId);
            const campaignData = common.accumulateCampaignSeries(await spdata.getCampaignHistory(entityId, campaignId));

            const keywords = await spdata.getKeywordData(entityId, campaignId, adGroupId);
            const renormedKws = common.renormKeywordStats(campaignData, keywords);

            if (target.target == 'acos') {
                return common.optimizeKeywordsAcos(target.value, renormedKws, options);
            }
            return common.optimizeKeywordsSalesPerDay(target.value, campaignData, campaignSummary, renormedKws, options);
        }),
        updateKeyword: kw => spdata.updateKeywordBid(kw.optimizedBid, [kw]),
    });
    ReactDOM.render(tabContent, container[0]);
}

function generateBulkUpdate(container, data) {
    const bulkUpdate = React.createElement(KeywordBulkUpdate, {
        data,
        onKeywordEnabledChange: async(enabled, keywords) => {
            const result = await spdata.updateKeywordStatus(enabled, keywords);
            if (result.fail.length)
                return result;
            return new Promise(() => window.location.reload()); // never resolves on purpose
        },
        onKeywordBidChange: async(bid, keywords) => {
            const result = await spdata.updateKeywordBid(bid, keywords);
            if (result.fail.length)
                return result;
            return new Promise(() => window.location.reload()); // never resolves on purpose
        },
        campaignPromise: ga.mpromise(async function() {
            const allowed = await spdata.getAllowedCampaignSummaries();
            return spdata.campaignSelectOptions(allowed);
        }),
        onKeywordCopy: spdata.copyKeywordsToCampaigns,
    });
    ReactDOM.render(bulkUpdate, container[0]);
}

