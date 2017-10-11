const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const ga = require('../common/ga.js');
const constants = require('../common/constants.js');
const tabber = require('../components/tabber.js');

const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const KeywordBulkUpdate = require('../components/KeywordBulkUpdate.jsx');

const tabClass = `machete-tab`;

const ourTabs = [
    {label: "Keyword Analytics", activate: generateKeywordReports, matching: /ads\/campaign/, insertIndex: 1 },
    {label: "Campaign History", activate: generateHistoryReports, matching: /./, insertIndex: 2 },
];

let allowedPromise = common.getCampaignAllowed(common.getEntityId(), common.getCampaignId());

let adGroupPromise = ga.mpromise(resolve => {
    let adGroupInterval = window.setInterval(() => {
        let adGroupIdInput = $('input[name=adGroupId]');
        if (!adGroupIdInput.length)
            return;

        let adGroupId = adGroupIdInput[0].value;
        window.clearInterval(adGroupInterval);

        chrome.runtime.sendMessage({
            action: 'setAdGroupMetadata',
            entityId: common.getEntityId(),
            campaignId: common.getCampaignId(),
            adGroupId,
        }, ga.mcatch(response => {
            if (response.error)
                 ga.merror(response.status, response.error);
        }));
        resolve(adGroupId);
    }, 100);
});

let keywordDataPromise = Promise.all([allowedPromise, adGroupPromise])
.then(results => ga.mcatch(() => {
    let [allowed, adGroupId] = results;
    if (allowed)
        return common.getKeywordData(common.getEntityId(), adGroupId);
    return [];
})());

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

    chrome.runtime.sendMessage({
        action: 'setCampaignMetadata',
        entityId: common.getEntityId(),
        campaignId: common.getCampaignId(),
        asin: match[1],
    }, ga.mcatch(response => {
        if (response.error)
             ga.merror(response.status, response.error);
    }));

    window.clearInterval(metadataInterval);
}), 100);

function addCampaignTabs(tabs) {
    for (let tab of ourTabs) {
        if (!location.toString().match(tab.matching)) {
            continue;
        }
        tabber(tabs, tab);
    }

    allowedPromise.then(allowed => {
        if (allowed) {
            // Render the bulk update control on the main keyword list
            const allTable = $('#keywordTableControls');
            if (allTable.find('#machete-bulk-all').length == 0) {
                // Hack ourselves into the Amazon layout
                const bulkContainer = $('<div class="a-span4 machete-kwupdate-all" id="machete-bulk-all"></div>');
                const first = $('#keywordTableControls').children().first();
                first.removeClass('a-span8');
                first.addClass('a-span4');
                first.after(bulkContainer);
                keywordDataPromise.then(data => generateBulkUpdate(bulkContainer, data));
            }
        }
    })
    .catch(ga.mex);
}

function generateKeywordReports(entityId, container) {
    const chart = React.createElement(KeywordAnalyticsTab, { 
        allowed: true, // assume true until we know otherwise
        anonymous: false,
        dataPromise: keywordDataPromise,
        updateStatus: () => console.warn("shouldn't update keywords while still loading"),
        updateBid: () => console.warn("shouldn't update keywords while still loading"),
    });
    ReactDOM.render(chart, container[0]);

    Promise.all([allowedPromise, common.getUser()]).then(results => {
        let [allowed, user] = results;
        const chart = React.createElement(KeywordAnalyticsTab, {
            allowed,
            anonymous: user.isAnon,
            dataPromise: keywordDataPromise,
            updateStatus,
            updateBid,
        });
        ReactDOM.render(chart, container[0]);
    })
    .catch(ga.mex);
}

function generateHistoryReports(entityId, container) {
    const campaignId = common.getCampaignId();
    const downloadHref = `https://${constants.hostname}/api/data/${entityId}/${campaignId}/csv`;

    Promise.all([allowedPromise, common.getUser()])
    .then(results => {
        const [allowed, user] = results;
        let tabContent = React.createElement(CampaignHistoryTab, {
            allowed,
            anonymous: user.isAnon,
            downloadHref,
            dataPromise: common.getCampaignHistory(entityId, campaignId)
                         .then(data => common.convertSnapshotsToDeltas(data, { rate: 'day', chunk: 'day' }))
        });
        ReactDOM.render(tabContent, container[0]);
    })
    .catch(ga.mex);
}

function generateBulkUpdate(container, data) {
    const bulkUpdate = React.createElement(KeywordBulkUpdate, {
        data,
        onEnabledChange: (enabled, keywords) => {
            updateStatus(keywords.map(kw => kw.id), enabled, () => window.location.reload());
        },
        onBidChange: (bid, keywords) => {
            updateBid(keywords.map(kw => kw.id), bid, () => window.location.reload());
        },
    });
    ReactDOM.render(bulkUpdate, container[0]);
}

