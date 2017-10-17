const $ = require('jquery');
const _ = require('lodash');
const co = require('co');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');

const tabber = require('../components/tabber.js');
const LoadingNotice = require('./LoadingNotice.jsx');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const AggregateHistory = require('../components/AggregateHistory.jsx');
const AggregateKeywords = require('../components/AggregateKeywords.jsx');

const now = Date.now();
const twoWeeks = 15 * constants.timespan.day;
const ninetyDays = 91 * constants.timespan.day;
const twoWeeksAgo = now - twoWeeks;
const ninetyDaysAgo = now - ninetyDays;

const tabClass = `machete-tab`;

// Map column names to data metrics
const charts = [
    { column: "Impr", label: "Impressions / day", metric: 'impressions' },
    { column: "Clicks", label: "Clicks / day", metric: 'clicks' },
    { column: "Spend", label: "Spend / day", metric: 'spend', },
    { column: "Orders", label: "Orders / day", metric: 'salesCount', },
    { column: "ACoS", label: "ACoS", metric: 'acos' },
    { column: "CTR", label: "CTR", metric: 'ctr' },
    { column: "CPC", label: "Cost per click ($)", metric: 'avgCpc' },
    { column: "Sales", label: "Sales ($) / day", metric: 'salesValue' },
];

const setSessionPromise = common.bgMessage({ action: 'setSession' });

let loadingInterval = window.setInterval(ga.mcatch(() => {
    const navbar = $('.sspa-navigation-bar');
    if (!navbar.length)
        return;

    let container = navbar.find(LoadingNotice.className).parent();
    if (!container.length) {
        container = $('<div style="position: absolute; width: 100%"></div>');
        navbar.prepend(container);
    }

    const loading = React.createElement(LoadingNotice, {});
    ReactDOM.render(loading, container[0]);

    setSessionPromise.then(() => container.remove());
    window.clearInterval(loadingInterval);
}), 100);

common.getUser().then(user => {
    window.setInterval(ga.mcatch(() => {
        let rows = $('.public_fixedDataTableRow_main');
        let header = rows.first();
        if (!header)
            return;

        let columnHeaders = header.find('.sspa-table-header');
        let columns = [];
        for (let i = 0; i < columnHeaders.length; i++) {
            columns.push(columnHeaders[i].innerText);
        }
        if (columns.length == 0)
            return;

        addChartButtons(columns, rows);
    }), 100);


    window.setInterval(ga.mcatch(() => {
        let tabs = $('.a-tabs');
        if (!tabs.length)
            return;
        if (tabs.hasClass(tabClass))
            return;
        tabs.addClass(tabClass);

        const loc = window.location.href;
        if (loc.match(/ad_group\/A\w+\//)) {
            tabber(tabs, { label: "Keyword Analytics", activate: generateKeywordReports });
        }
        else if (loc.match(/ad_groups\//)) {
            tabber(tabs, { label: "Campaign History", activate: generateCampaignHistory });
        }
        else if (loc.match(/campaigns\//)) {
            tabber(tabs, { label: "Aggregate Campaign History", activate: activateAggregateHistoryTab });
            tabber(tabs, { label: "Aggregate Keyword Analytics", activate: activateAggregateKeywordTab });
        }
    }), 100);

    function addChartButtons(columns, rows) {
        for (let row of rows) {
            let cells = $(row).find('.sspa-table-cell-container');
            if (cells.length == 0)
                continue;

            let link = $(cells[2]).find('a')[0];
            if (!link)
                continue;

            for (let chart of charts) {
                let target = cells[columns.indexOf(chart.column)];
                if (!target)
                    continue;

                if ($(target).find(`.${DashboardHistoryButton.chartClass}`).length)
                    continue;

                let btn = React.createElement(DashboardHistoryButton, {
                    allowed: user.isSeller,
                    anonymous: user.isAnon,
                    metric: chart.metric,
                    title: chart.label,
                    dataPromiseFactory: () => fetchDataPromise(window.location.href, link.href).then(data => {
                        const campaignData = common.parallelizeSeries(data);
                        return formatParallelData(campaignData, chart.metric);
                    }),
                });
                const container = $('<span></span>');
                $(target).children().first().append(container);
                ReactDOM.render(btn, container[0]);
            }
        }
    }

    function formatParallelData(data, name) {
        return {
            timestamp: data.timestamp,
            data: data[name],
            name,
        };
    }

    function fetchDataPromise(locationHref, linkHref, startTimestamp, endTimestamp) {
        let { campaignId, adGroupId } = common.getSellerCampaignId(linkHref);
        let args = { startTimestamp: startTimestamp || twoWeeksAgo, endTimestamp: endTimestamp || now };

        if (adGroupId && campaignId) {
            // We're on the campaign detail page looking at a link to a particular
            // ad group.
            args = Object.assign(args, { action: 'getAdGroupDataRange', campaignId, adGroupId });
        }
        else if (campaignId) {
            // We're on the overall campaign page, looking at a link to a campaign
            // detail page.
            args = Object.assign(args, { action: 'getCampaignDataRange', campaignId });
        }
        else {
            // We're on the adGroup page, looking at a link to the product. The
            // current location has the campaignId and the adGroupId.
            ({ campaignId, adGroupId } = common.getSellerCampaignId(locationHref));
            const asin = common.getAsin(linkHref);
            args = Object.assign(args, { action: 'getAdDataRangeByAsin', campaignId, adGroupId, asin });
        }

        return common.bgMessage(args);
    }

    function getKeywordDataAggregate() {
        let { campaignId, adGroupId } = common.getSellerCampaignId(window.location.href);
        return keywordDataPromise({ campaignId, adGroupId }, ninetyDaysAgo, now);
    }

    function generateCampaignHistory(container) {
        const { campaignId } = common.getSellerCampaignId(window.location.href);
        const content = React.createElement(CampaignHistoryTab, {
            allowed: user.isSeller,
            anonymous: user.isAnon,
            downloadHref: `https://${constants.hostname}/api/seller/campaignData/${campaignId}/1-${Date.now()}/csv`,
            dataPromise: fetchDataPromise(window.location.href, window.location.href, 1),
        });
        ReactDOM.render(content, container[0]);
    }

    function generateKeywordReports(container) {
        let content = React.createElement(KeywordAnalyticsTab, {
            allowed: user.isSeller,
            anonymous: false,
            dataPromise: getKeywordDataAggregate(),
            updateStatus: (ids, enabled, cb) => updateStatus(ids, enabled).then(cb),
            updateBid: (ids, bid, cb) => updateBid(ids, bid).then(cb),
        });
        ReactDOM.render(content, container[0]);
    }

    function campaignSelectOptions(summaries) {
        let options = [];

        const campaigns = _.groupBy(summaries, x => x.campaignId);
        options = options.concat(..._.keys(campaigns).map(x => ({
            value: campaigns[x],
            label: `Campaign: ${campaigns[x][0].campaignName}`,
        })));

        const adGroups = _.groupBy(summaries, x => x.adGroupId);
        options = options.concat(..._.keys(adGroups).map(x => ({
            value: adGroups[x],
            label: `Campaign: ${adGroups[x][0].campaignName} > Ad Group: ${adGroups[x][0].adGroupName}`
        })));

        options = options.concat(...summaries.map(x => ({
            value: [x],
            label: `Campaign: ${x.campaignName} > Ad Group: ${x.adGroupName} > Ad: ${x.title}`
        })));

        const products = _.groupBy(summaries, x => x.asin);
        options = options.concat(..._.keys(products).map(x => ({
            value: products[x],
            label: `Ads for ${products[x][0].title} (ASIN ${x})`
        })));

        return [{ value: summaries, label: 'All Campaigns' }].concat(..._.sortBy(options, ['label']));
    }

    function keywordSelectOptions(summaries) {
        let options = [];

        const campaigns = _.groupBy(summaries, x => x.campaignId);
        options = options.concat(..._.keys(campaigns).map(x => ({
            value: campaigns[x],
            label: `Campaign: ${campaigns[x][0].campaignName}`,
        })));

        const adGroups = _.groupBy(summaries, x => x.adGroupId);
        options = options.concat(..._.keys(adGroups).map(x => ({
            value: adGroups[x],
            label: `Campaign: ${adGroups[x][0].campaignName} > Ad Group: ${adGroups[x][0].adGroupName}`
        })));

        return [{ value: summaries, label: 'All Campaigns' }].concat(..._.sortBy(options, ['label']));
    }

    function adDataPromise(summary, startTimestamp, endTimestamp) {
        return common.bgMessage({
            action: 'getAdDataRange',
            campaignId: summary.campaignId,
            adGroupId: summary.adGroupId,
            adId: summary.adId,
            startTimestamp,
            endTimestamp
        });
    }

    function keywordDataPromise(summary, startTimestamp, endTimestamp) {
        return common.bgMessage({
            action: 'getKeywordDataRange',
            campaignId: summary.campaignId,
            adGroupId: summary.adGroupId,
            startTimestamp,
            endTimestamp
        }).then(common.accumulateKeywordSeries);
    }

    function activateAggregateHistoryTab(container) {
        let aggContent = React.createElement(AggregateHistory, {
            campaignPromise: common.getSellerCampaignSummaries().then(campaignSelectOptions),
            loadDataPromise: (summaries) => co(function*() {
                const histories = yield Promise.all(summaries.map(x => adDataPromise(x, 1, now)));
                const aggSeries = common.aggregateSeries(histories, { chunk: 'day' });
                return aggSeries;
            }),
        });
        ReactDOM.render(aggContent, container[0]);
    }

    function activateAggregateKeywordTab(container) {
        let aggContent = React.createElement(AggregateKeywords, {
            campaignPromise: common.getSellerCampaignSummaries().then(keywordSelectOptions),
            loadDataPromise: (summaries) => co(function*() {
                const adGroups = _.uniqBy(summaries, x => x.adGroupId);
                const kwSeries = yield Promise.all(adGroups.map(x => keywordDataPromise(x, ninetyDaysAgo, now)));
                const aggregate = common.aggregateKeywords(kwSeries);
                return aggregate;
            }),
            updateStatus: (ids, enabled, callback) => {
                const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
                updateStatus(idList, enabled).then(callback);
            },
            updateBid: (ids, bid, callback) => {
                const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
                updateBid(idList, bid).then(callback);
            },
        });
        ReactDOM.render(aggContent, container[0]);
    }


    function updateKeyword(data) {
        return $.ajax({
            url: 'https://sellercentral.amazon.com/hz/cm/keyword/update',
            method: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            dataType: 'json',
        })
        .then(() => ({ success: true }))
        .catch(error => ({ error }));
    }

    function updateStatus(keywordIds, enabled) {
        const status = enabled ? 'ENABLED' : 'PAUSED';
        const postData = { entities: keywordIds.map(id => ({ id, status })) };
        return updateKeyword(postData);
    }

    function updateBid(keywordIds, bid) {
        const postData = { entities: keywordIds.map(id => ({ id, bid })) };
        return updateKeyword(postData);
    }
});
