const $ = require('jquery');
const _ = require('lodash');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const sdata = require('../common/seller-data.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');

const tabber = require('../components/tabber.js');
const LoadingNotice = require('./LoadingNotice.jsx');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const KeywordAnalyticsTab = require('../components/KeywordAnalyticsTab.jsx');
const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const AggregateHistory = require('../components/AggregateHistory.jsx');
const AggregateKeywords = require('../components/AggregateKeywords.jsx');
const BidOptimizerTab = require('../components/BidOptimizerTab.jsx');

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

const startSessionPromise = common.bgMessage({ action: 'startSession' });

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

    startSessionPromise.then(ga.mcatch(() => container.remove()));
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
            tabber(tabs, { label: "Bid Optimizer", activate: generateBidOptimizer });
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
                    dataPromiseFactory: ga.mcatch(() => fetchDataPromise(window.location.href, link.href).then(data => {
                        const campaignData = common.parallelizeSeries(data);
                        return [common.formatParallelData(campaignData, constants.metric[chart.metric])];
                    })),
                });
                const container = $('<span></span>');
                $(target).children().first().append(container);
                ReactDOM.render(btn, container[0]);
            }
        }
    }

    function fetchDataPromise(locationHref, linkHref, startTimestamp, endTimestamp) {
        let { campaignId, adGroupId } = sdata.getCampaignId(linkHref);
        let args = { startTimestamp: startTimestamp || twoWeeksAgo, endTimestamp: endTimestamp || now };

        if (adGroupId && campaignId) {
            // We're on the campaign detail page looking at a link to a particular
            // ad group.
            args = Object.assign(args, { action: 'seller.getAdGroupDataRange', campaignId, adGroupId });
        }
        else if (campaignId) {
            // We're on the overall campaign page, looking at a link to a campaign
            // detail page.
            args = Object.assign(args, { action: 'seller.getCampaignDataRange', campaignId });
        }
        else {
            // We're on the adGroup page, looking at a link to the product. The
            // current location has the campaignId and the adGroupId.
            ({ campaignId, adGroupId } = sdata.getCampaignId(locationHref));
            const asin = sdata.getAsin(linkHref);
            args = Object.assign(args, { action: 'seller.getAdDataRangeByAsin', campaignId, adGroupId, asin });
        }

        return common.bgMessage(args).then(data => data.sort(common.timestampSort));
    }

    function getKeywordDataAggregate() {
        let { campaignId, adGroupId } = sdata.getCampaignId(window.location.href);
        return keywordDataPromise({ campaignId, adGroupId }, ninetyDaysAgo, now);
    }

    function generateCampaignHistory(container) {
        const content = React.createElement(CampaignHistoryTab, { dataPromise: fetchDataPromise(window.location.href, window.location.href, 1) });
        ReactDOM.render(content, container[0]);
    }

    function generateKeywordReports(container) {
        let content = React.createElement(KeywordAnalyticsTab, {
            dataPromise: getKeywordDataAggregate(),
            updateStatus: ga.mcatch((ids, enabled, cb) => updateStatus(ids, enabled).then(cb)),
            updateBid: ga.mcatch((ids, bid, cb) => updateBid(ids, bid).then(cb)),
        });
        ReactDOM.render(content, container[0]);
    }

    function generateBidOptimizer(container) {
        const campaignKey = sdata.getCampaignId(window.location.href);

        const tabContent = React.createElement(BidOptimizerTab, {
            defaultTarget: 'acos',
            defaultTargetValue: 70,
            keywordPromiseFactory: (target, options) => ga.mpromise(async function() {
                const keywords = await getKeywordDataAggregate();
                const summaries = await sdata.getCampaignSummaries();

                // Hack: since we get campaign data from the last 90 days, we need to adjust the campaign info to cover the same period.
                const campaignSummary = summaries.find(x => x.campaignId == campaignKey.campaignId);
                campaignSummary.startDate = new Date(Math.max(ninetyDaysAgo, new Date(campaignSummary.startDate).getTime()));

                const campaignData = common.accumulateCampaignSeries(await fetchDataPromise(window.location.href, window.location.href, ninetyDaysAgo, now));
                const renormedKws = common.renormKeywordStats(campaignData, keywords);

                if (target.target == 'acos') {
                    return common.optimizeKeywordsAcos(target.value, renormedKws, options);
                }
                return common.optimizeKeywordsSalesPerDay(target.value, campaignData, campaignSummary, renormedKws, options);
            }),
            updateKeyword: kw => updateBid([kw.id], kw.optimizedBid),
        });
        ReactDOM.render(tabContent, container[0]);
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
            action: 'seller.getAdDataRange',
            campaignId: summary.campaignId,
            adGroupId: summary.adGroupId,
            adId: summary.adId,
            startTimestamp,
            endTimestamp
        });
    }

    function keywordDataPromise(summary, startTimestamp, endTimestamp) {
        return common.bgMessage({
            action: 'seller.getKeywordDataRange',
            campaignId: summary.campaignId,
            adGroupId: summary.adGroupId,
            startTimestamp,
            endTimestamp
        }).then(common.accumulateKeywordSeries);
    }

    function activateAggregateHistoryTab(container) {
        let aggContent = React.createElement(AggregateHistory, {
            campaignPromise: sdata.getCampaignSummaries().then(campaignSelectOptions),
            loadDataPromise: summaries => ga.mpromise(async function() {
                const histories = await Promise.all(summaries.map(x => adDataPromise(x, 1, now)));
                const aggregate = histories
                                  .reduce((array, deltas) => array.concat(...deltas), [])
                                  .sort(common.timestampSort);
                return aggregate;
            }),
        });
        ReactDOM.render(aggContent, container[0]);
    }

    function activateAggregateKeywordTab(container) {
        let aggContent = React.createElement(AggregateKeywords, {
            campaignPromise: sdata.getCampaignSummaries().then(keywordSelectOptions),
            loadDataPromise: summaries => ga.mpromise(async function() {
                const adGroups = _.uniqBy(summaries, x => x.adGroupId);
                const kwSeries = await Promise.all(adGroups.map(x => keywordDataPromise(x, ninetyDaysAgo, now)));
                const aggregate = common.aggregateKeywords(kwSeries);
                return aggregate;
            }),
            updateStatus: ga.mcatch((ids, enabled, callback) => {
                const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
                updateStatus(idList, enabled).then(callback);
            }),
            updateBid: ga.mcatch((ids, bid, callback) => {
                const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
                updateBid(idList, bid).then(callback);
            }),
        });
        ReactDOM.render(aggContent, container[0]);
    }

    function updateKeyword(data) {
        return $.ajax('https://sellercentral.amazon.com/hz/cm/keyword/update', {
            method: 'POST',
            jsonData: data,
            responseType: 'json',
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
