const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const spdata = require('../common/sp-data.js');
const ga = require('../common/ga.js');
const tabber = require('../components/tabber.js');

const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const KeywordBulkUpdate = require('../components/KeywordBulkUpdate.jsx');

const tabClass = `machete-tab`;

const ourTabs = [
    {label: "Keyword Analytics", activate: generateKeywordReports, matching: /ads\/campaign/, insertIndex: 1 },
    {label: "Campaign History", activate: generateHistoryReports, matching: /./, insertIndex: 2 },
];

let adGroupPromise = ga.mpromise(resolve => {
    let adGroupInterval = window.setInterval(ga.mcatch(() => {
        let adGroupIdInput = $('input[name=adGroupId]');
        if (!adGroupIdInput.length)
            return;

        let adGroupId = adGroupIdInput[0].value;
        window.clearInterval(adGroupInterval);

        common.bgMessage({
            action: 'setAdGroupMetadata',
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
        action: 'setCampaignMetadata',
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
        updateStatus: (ids, enabled, callback) => spdata.updateKeywordStatus(ids, enabled).then(callback),
        updateBid: (ids, bid, callback) => spdata.updateKeywordBid(ids, bid).then(callback),
    });
    ReactDOM.render(chart, container[0]);
}

function generateHistoryReports(container) {
    const entityId = spdata.getEntityId();
    const campaignId = spdata.getCampaignId();
    let tabContent = React.createElement(CampaignHistoryTab, { dataPromise: spdata.getCampaignHistory(entityId, campaignId) });
    ReactDOM.render(tabContent, container[0]);
}

function generateBulkUpdate(container, data) {
    const bulkUpdate = React.createElement(KeywordBulkUpdate, {
        data,
        onEnabledChange: (enabled, keywords) => spdata.updateKeywordStatus(keywords.map(kw => kw.id), enabled).then(window.location.reload),
        onBidChange: (bid, keywords) => spdata.updateKeywordBid(keywords.map(kw => kw.id), bid).then(window.location.reload),
    });
    ReactDOM.render(bulkUpdate, container[0]);
}

