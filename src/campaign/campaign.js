const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');
const co = require('co');

const common = require('../common/common.js');
const spdata = require('../common/sp-data.js');
const ga = require('../common/ga.js');
const tabber = require('../components/tabber.js');

const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const BidOptimizerTab = require('../components/BidOptimizerTab.jsx');
const KeywordBulkUpdate = require('../components/KeywordBulkUpdate.jsx');

const tabClass = `machete-tab`;

const ourTabs = [
    { label: "Keyword Analytics", activate: generateKeywordReports, matching: /./, insertIndex: 1 },
    { label: "Campaign History", activate: generateHistoryReports, matching: /./, insertIndex: 2 },
    { label: "Bid Optimizer", activate: generateBidOptimizer, matching: /./, insertIndex: 3 },
];

const adGroupId = spdata.getAdGroupIdFromDOM(document);
const keywordDataPromise = spdata.getKeywordData(spdata.getEntityId(), adGroupId);

spdata.startSession();
spdata.amsPageInit();

let makeTabsInterval = window.setInterval(ga.mcatch(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
        window.clearInterval(makeTabsInterval);
    }
}), 100);

function addCampaignTabs(tabs) {
    for (let tab of ourTabs) {
        if (!location.toString().match(tab.matching)) {
            continue;
        }
        tabber(tabs, tab);
    }

    // Render the bulk update control on the main keyword list
    const allTable = $('#keywordTableControls');
    if (allTable.find('#machete-bulk-all').length == 0) {
        keywordDataPromise.then(data => {
            // Hack ourselves into the Amazon layout
            const bulkContainer = $('<div class="a-span4 machete-kwupdate-all" id="machete-bulk-all"></div>');
            const first = $('#keywordTableControls').children().first();
            first.removeClass('a-span8');
            first.addClass('a-span4');
            first.after(bulkContainer);
            generateBulkUpdate(bulkContainer, data);
        });
    }
}

function generateKeywordReports(container) {
    const chart = React.createElement(KeywordAnalyticsTab, {
        dataPromise: keywordDataPromise,
        updateStatus: ga.mcatch((ids, enabled, callback) => spdata.updateKeywordStatus(ids, enabled).then(callback)),
        updateBid: ga.mcatch((ids, bid, callback) => spdata.updateKeywordBid(ids, bid).then(callback)),
    });
    ReactDOM.render(chart, container[0]);
}

function generateHistoryReports(container) {
    const entityId = spdata.getEntityId();
    const campaignId = spdata.getCampaignId();
    let tabContent = React.createElement(CampaignHistoryTab, { 
        dataPromise: co(function*() {
            const amsData = yield spdata.getCampaignHistory(entityId, campaignId);
            if (yield spdata.hasKdpIntegration()) {
                const summary = yield* spdata.getCampaignSummary(entityId, campaignId);
                const kdpData = yield spdata.getKdpSalesHistory(summary.asin);
                return spdata.calculateKnpIncome(amsData, kdpData);
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
        keywordPromiseFactory: (opts) => ga.mpromise(co(function*() {
            const summaries = yield spdata.getCampaignSummaries(entityId);
            const campaignSummary = summaries.find(x => x.campaignId == campaignId);
            const adGroupIds = summaries.filter(x => x.asin == campaignSummary.asin).map(x => x.adGroupId);
            const aggrKws = common.aggregateKeywords(yield spdata.getAggregateKeywordData(entityId, adGroupIds));
            const campaignData = common.accumulateCampaignSeries(yield spdata.getCampaignHistory(entityId, campaignId));
            const renormedKws = common.renormKeywordStats(campaignData, aggrKws);

            if (opts.target == 'acos') {
                return common.optimizeKeywordsAcos(opts.value, renormedKws);
            }
            else if (opts.target == 'sales') {
                return common.optimizeKeywordsSalesPerDay(opts.value, campaignData, campaignSummary, renormedKws);
            }
            throw new Error("Don't know how to optimize for " + opts.target);
        })),
        updateKeyword: kw => ga.mpromise(co(function*() {
            const origKws = yield spdata.getKeywordData(entityId, adGroupId);
            const origKw = origKws.find(orig => kw.id.includes(orig.id));
            if (!origKw)
                return;
            if (origKw.bid === kw.bid)
                return;
            console.log('updated', origKw, 'to', kw);
            // yield spdata.updateKeywordBid([origKw.id], kw.bid);
        })),
    });
    ReactDOM.render(tabContent, container[0]);
}

function generateBulkUpdate(container, data) {
    const bulkUpdate = React.createElement(KeywordBulkUpdate, {
        data,
        onEnabledChange: ga.mcatch((enabled, keywords) => 
                                   spdata.updateKeywordStatus(keywords.map(kw => kw.id), enabled).then(() => window.location.reload())),
        onBidChange: ga.mcatch((bid, keywords) => 
                               spdata.updateKeywordBid(keywords.map(kw => kw.id), bid).then(() => window.location.reload())),
    });
    ReactDOM.render(bulkUpdate, container[0]);
}

