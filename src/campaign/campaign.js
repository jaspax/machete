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

let adGroupPromise = ga.mpromise(resolve => {
    let adGroupInterval = window.setInterval(ga.mcatch(() => {
        let adGroupIdInput = $('input[name=adGroupId]');
        if (!adGroupIdInput.length)
            return;

        let adGroupId = adGroupIdInput[0].value;
        window.clearInterval(adGroupInterval);

        common.bgMessage({
            action: 'sp.setAdGroupMetadata',
            entityId: spdata.getEntityId(),
            campaignId: spdata.getCampaignId(),
            adGroupId,
        });
        resolve(adGroupId);
    }), 100);
});

let keywordDataPromise = adGroupPromise.then(adGroupId => spdata.getKeywordData(spdata.getEntityId(), adGroupId));

let makeTabsInterval = window.setInterval(ga.mcatch(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
        window.clearInterval(makeTabsInterval);
    }
}), 100);

let metadataInterval = window.setInterval(ga.mcatch(() => {
    let campaignDataTab = $('#campaign_settings_tab_content');
    if (campaignDataTab.length == 0)
        return;

    let bookLink = campaignDataTab.find('#advertisedBookRow').find('a');
    if (bookLink.length == 0)
        return;

    let href = bookLink[0].href;
    let match = href.match(/product\/(\w+)/);
    if (!match || match.length < 2)
        return;

    common.bgMessage({
        action: 'sp.setCampaignMetadata',
        entityId: spdata.getEntityId(),
        campaignId: spdata.getCampaignId(),
        asin: match[1],
    });

    window.clearInterval(metadataInterval);
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
    let tabContent = React.createElement(CampaignHistoryTab, { dataPromise: spdata.getCampaignHistory(entityId, campaignId) });
    ReactDOM.render(tabContent, container[0]);
}

function generateBidOptimizer(container) {
    const entityId = spdata.getEntityId();
    const campaignId = spdata.getCampaignId();

    function* prepareKwData() {
        const summaries = yield spdata.getCampaignSummaries(entityId);
        const campaignSummary = summaries.find(x => x.campaignId == campaignId);
        const adGroupIds = summaries.filter(x => x.asin == campaignSummary.asin).map(x => x.adGroupId);
        const aggrKws = common.aggregateKeywords(yield spdata.getAggregateKeywordData(entityId, adGroupIds));
        const campaignData = common.accumulateCampaignSeries(yield spdata.getCampaignHistory(entityId, campaignId));
        const renormedKws = common.renormKeywordStats(campaignData, aggrKws);
        return { renormedKws, campaignSummary, campaignData };
    }

    const tabContent = React.createElement(BidOptimizerTab, {
        targetAcos: 70,
        targetSales: 0,
        optimizeAcos: value => ga.mpromise(co(function*() {
            const prep = yield* prepareKwData();
            return common.optimizeKeywordsAcos(value, prep.renormedKws);
        })),
        optimizeSales: value => ga.mpromise(co(function*() {
            const prep = yield* prepareKwData();
            return common.optimizeKeywordsSalesPerDay(value, prep.campaignData, prep.campaignSummary, prep.renormedKws);
        })),
        updateKeyword: kw => ga.mpromise(co(function*() {
            const origKws = yield spdata.getKeywordData(entityId, yield adGroupPromise);
            const origKw = origKws.find(orig => kw.id.includes(orig.id));
            if (!origKw)
                return;
            if (origKw.bid === kw.bid)
                return;
            yield spdata.updateKeywordBid([origKw.id], kw.bid);
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

