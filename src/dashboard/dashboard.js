const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');
const co = require('co');
const _ = require('lodash');

const common = require('../common/common.js');
const spdata = require('../common/sp-data.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const AggregateHistory = require('../components/AggregateHistory.jsx');
const AggregateKeywords = require('../components/AggregateKeywords.jsx');
const AmsCampaignRow = require('../components/AmsCampaignRow.jsx');
const KdpTab = require('../components/KdpTab.jsx');
const tabber = require('../components/tabber.js');

const twoWeeks = 15 * constants.timespan.day;
const startTimestamp = Date.now() - twoWeeks;
const charts = [
    { column: 6, label: "Impressions / day", metric: [constants.metric.impressions] },
    { column: 7, label: "Clicks / day", metric: [constants.metric.clicks] },
    { column: 8, label: "Avg CPC", metric: [constants.metric.avgCpc] },
    { column: 9, label: "Spend / day", metric: [constants.metric.spend] },
    { column: 10, label: "Sales ($) / day", metric: [constants.metric.salesValue, constants.metric.knpeValue, constants.metric.knpeTotalValue] },
    { column: 11, label: "ACOS", metric: [constants.metric.acos, constants.metric.knpeAcos] },
];

window.setInterval(ga.mcatch(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let wrapper = $('#campaignTable_wrapper');
    addTabs(wrapper);
    addTotalsRow(wrapper);
}), 100);

function addTabs(wrapper) {
    if (wrapper.hasClass('a-tab-container'))
        return;
    const detachedChildren = wrapper.children().detach();

    const tabs = $('<ul class="a-tabs a-declarative"></ul>');
    wrapper.append(tabs);
    wrapper.addClass('a-tab-container');

    let {container} = tabber(tabs, { label: 'Dashboard', active: true });
    container.append(detachedChildren);

    tabber(tabs, { 
        label: 'Aggregate History',
        activate: activateAggregateHistoryTab,
    });

    tabber(tabs, {
        label: 'Aggregate Keywords',
        activate: activateAggregateKeywordTab,
    });

    tabber(tabs, {
        label: "Enable KDP",
        activate: activateKdpTab,
    });
}

function addTotalsRow(wrapper) {
    if (!wrapper.length || wrapper.find('#machete-totals').length)
        return;

    const head = wrapper.find('#campaignTable thead');
    if (!head.length)
        return;

    const body = $('<tbody id="machete-totals"></tbody>');
    head.after(body);

    spdata.getCampaignSummaries().then(summaries => {
        const activeCampaigns = summaries.filter(x => spdata.isRunning(x));
        const lastDay = common.sumCampaignSnapshots(activeCampaigns.map(x => x.latestData));
        lastDay.budget = activeCampaigns.reduce((sum, x) => sum + x.budget, 0);

        const totalRow = React.createElement(AmsCampaignRow, { 
            label: "Yesterday's Totals",
            lastDay,
            syncPromise: spdata.startSessionPromise,
        });
        ReactDOM.render(totalRow, body[0]);
    });
}

function campaignSelectOptions(campaigns) {
    let options = [
        { value: campaigns, label: 'All Campaigns' },
        { value: campaigns.filter(c => spdata.isRunning(c)), label: 'All Active Campaigns' }
    ].concat(...campaigns.map(c => ({ value: [c], label: 'Campaign: ' + c.name })));

    for (const asin of _.uniq(campaigns.map(c => c.asin).filter(a => a))) {
        options.push({ value: campaigns.filter(c => c.asin == asin), label: 'Campaigns for ASIN: ' + asin });
    }
    return options;
}

function activateAggregateHistoryTab(container) {
    let aggContent = React.createElement(AggregateHistory, {
        campaignPromise: spdata.getCampaignSummaries().then(campaignSelectOptions),
        loadDataPromise: (summaries) => co(function*() {
            const campaignIds = _.uniq(summaries.map(x => x.campaignId));
            return yield spdata.getAggregateCampaignHistory(spdata.getEntityId(), campaignIds);
        }),
    });
    ReactDOM.render(aggContent, container[0]);
}

function activateAggregateKeywordTab(container) {
    let aggContent = React.createElement(AggregateKeywords, {
        campaignPromise: spdata.getCampaignSummaries(spdata.getEntityId()).then(campaignSelectOptions),
        loadDataPromise: (summaries) => co(function*() {
            const adGroupIds = _.uniq(summaries.map(x => x.adGroupId).filter(x => x && x != 'null'));
            const kwData = yield spdata.getAggregateKeywordData(spdata.getEntityId(), adGroupIds);
            const aggKws = common.aggregateKeywords(kwData);
            return aggKws;
        }),
        updateStatus: ga.mcatch((ids, enabled, callback) => {
            const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
            spdata.updateKeywordStatus(idList, enabled).then(callback);
        }),
        updateBid: ga.mcatch((ids, bid, callback) => {
            const idList = _.uniq(ids.reduce((array, item) => array.concat(...item), []));
            spdata.updateKeywordBid(idList, bid).then(callback);
        }),
    });
    ReactDOM.render(aggContent, container[0]);
}

function activateKdpTab(container) {
    let kdpContent = React.createElement(KdpTab, {});
    ReactDOM.render(kdpContent, container[0]);
}

function addChartButtons(rows) {
    for (let row of rows) {
        if ($(row).find(`.${DashboardHistoryButton.chartClass}`).length)
            continue; 

        let cells = $(row).children();
        let link = $(cells[1]).find('a')[0];
        if (!link)
            continue;

        let href = link.href;
        let campaignId = spdata.getCampaignId(href);

        const renderButtons = ga.mcatch((allowed, anonymous, summary) => {
            for (let chart of charts) {
                let target = cells[chart.column];
                if (!target)
                    continue;

                const dataPromiseFactory = () => co(function*() {
                    const data = yield spdata.getCampaignHistory(spdata.getEntityId(), campaignId);
                    const deltas = common.chunkSeries(data, 'day').filter(x => x.timestamp > startTimestamp);

                    const knpe = spdata.calculateKnpIncome(deltas, summary.kdp);
                    console.log(knpe);

                    const campaignData = common.parallelizeSeries(knpe);
                    return chart.metric.map(metric => common.formatParallelData(campaignData, metric));
                });

                let container = $(target).find('.machete-dash-container');
                if (!container.length) {
                    container = $('<span class="machete-dash-container"></span>');
                    $(target).append(container);
                }

                let btn = React.createElement(DashboardHistoryButton, {
                    allowed,
                    anonymous,
                    metric: chart.metric[0].prop,
                    title: chart.label,
                    dataPromiseFactory,
                });
                ReactDOM.render(btn, container[0]);

                if (summary && summary.latestData && allowed && !$(target).find('.machete-ghost').length) {
                    const metric = chart.metric[0];
                    const value = metric.format(summary.latestData[metric.prop]);
                    $(target).append(`<div><span class="machete-ghost">New:</span>${value}</div>`);
                }
            }
        });

        renderButtons(false, true, {});

        ga.mpromise(Promise.all([spdata.getCampaignAllowed(spdata.getEntityId(), campaignId), common.getUser(), spdata.getCampaignSummaries()]))
        .then(results => {
            const [allowed, user, summaries] = results;
            const summary = summaries.find(x => x.campaignId == campaignId);
            renderButtons(allowed, user.isAnon, summary);
        });
    }
}

