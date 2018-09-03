const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');
const _ = require('lodash');

const common = require('../common/common.js');
const spdata = require('../common/sp-data.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const AggregateHistory = require('../components/AggregateHistory.jsx');
const AggregateKeywords = require('../components/AggregateKeywords.jsx');
const AmsCampaignRow = require('../components/AmsCampaignRow.jsx');
const AmsCampaignTitleCell = require('../components/AmsCampaignTitleCell.jsx');
const KdpTab = require('../components/KdpTab.jsx');
const tabber = require('../components/tabber.js');

const twoWeeks = 15 * constants.timespan.day;
const startTimestamp = Date.now() - twoWeeks;
const charts = [
    { column: 6, columnTitle: 'Impressions', label: "Impressions / day", metric: [constants.metric.impressions] },
    { column: 7, columnTitle: 'Clicks', label: "Clicks / day", metric: [constants.metric.clicks] },
    { column: 8, columnTitle: 'CPC', label: "Avg CPC", metric: [constants.metric.avgCpc] },
    { column: 9, columnTitle: 'Spend', label: "Spend / day", metric: [constants.metric.spend] },
    { column: 10, columnTitle: 'Sales', label: "Sales ($) / day", metric: [constants.metric.salesValue, constants.metric.knpeValue, constants.metric.knpeTotalValue] },
    { column: 11, columnTitle: 'ACoS', label: "ACOS", metric: [constants.metric.acos, constants.metric.knpeAcos] },
];

spdata.startSession();
spdata.amsPageInit();

window.setInterval(ga.mcatch(() => {
    let wrapper = $('#campaignTable_wrapper');
    if (!wrapper.length) {
        wrapper = $('.page-container div').first().children().last();
    }

    addTabs(wrapper);
    addTotalsRow(wrapper);
    addChartButtons(wrapper);
}), 100);

function addTabs(wrapper) {
    if (wrapper.hasClass('a-tab-container'))
        return;
    tabber(wrapper, { label: 'Dashboard', active: true });

    tabber(wrapper, { 
        label: 'Aggregate History',
        activate: activateAggregateHistoryTab,
    });

    tabber(wrapper, {
        label: 'Aggregate Keywords',
        activate: activateAggregateKeywordTab,
    });

    tabber(wrapper, {
        label: "KDP Integration",
        activate: activateKdpTab,
    });
}

function addTotalsRow(wrapper) {
    if (!wrapper.length || wrapper.find('#machete-totals').length)
        return;

    const head = wrapper.find('#campaignTable thead');
    if (head.length) { // original UI
        const body = $('<tbody id="machete-totals"></tbody>');
        head.after(body);

        const totalRow = React.createElement(AmsCampaignRow, { 
            label: "Yesterday's Totals",
            lastDay: {},
            syncPromise: spdata.startSession(),
        });
        ReactDOM.render(totalRow, body[0]);

        spdata.getCampaignSummaries().then(summaries => {
            const activeCampaigns = summaries.filter(x => spdata.isRunning(x));
            const lastDay = common.sumCampaignSnapshots(activeCampaigns.map(x => x.latestData));
            lastDay.budget = activeCampaigns.reduce((sum, x) => sum + x.budget, 0);

            const totalRow = React.createElement(AmsCampaignRow, { 
                label: "Yesterday's Totals",
                lastDay,
                syncPromise: spdata.startSession(),
            });
            ReactDOM.render(totalRow, body[0]);
        });
    }

    else {
        const topRows = $('[role=rowgroup]').first();
        const totalCell = topRows.children().last();
        totalCell.attr('id', 'machete-totals');

        const ourCell = React.createElement(AmsCampaignTitleCell, {
            title: '',
            syncPromise: spdata.startSession(),
        });
        ReactDOM.unmountComponentAtNode(totalCell[0]);
        ReactDOM.render(ourCell, totalCell[0]);
    }
}

function campaignSelectOptions(campaigns) {
    let options = [
        { value: campaigns, label: 'All Campaigns' },
        { value: campaigns.filter(c => spdata.isRunning(c)), label: 'All Active Campaigns' }
    ].concat(...campaigns.filter(c => c.name).map(c => ({ value: [c], label: 'Campaign: ' + c.name })));

    for (const asin of _.uniq(campaigns.map(c => c.asin).filter(a => a && a != 'null'))) {
        options.push({ value: campaigns.filter(c => c.asin == asin), label: 'Campaigns for ASIN: ' + asin });
    }
    return options;
}

function activateAggregateHistoryTab(container) {
    let aggContent = React.createElement(AggregateHistory, {
        campaignPromise: ga.mpromise(async function() {
            const allowed = await spdata.getAllowedCampaignSummaries();
            return campaignSelectOptions(allowed);
        }),
        loadDataPromise: ga.mcatch(summaries => {
            const campaignIds = _.uniq(summaries.map(x => x.campaignId));
            return spdata.getAggregateCampaignHistory(spdata.getEntityId(), campaignIds);
        }),
    });
    ReactDOM.render(aggContent, container[0]);
}

function activateAggregateKeywordTab(container) {
    let aggContent = React.createElement(AggregateKeywords, {
        campaignPromise: ga.mpromise(async function() {
            const allowed = await spdata.getAllowedCampaignSummaries();
            return campaignSelectOptions(allowed);
        }),
        loadDataPromise: summaries => ga.mpromise(async function() {
            const adGroupIds = _.uniq(summaries.map(x => x.adGroupId).filter(x => x && x != 'null'));
            const kwData = await spdata.getAggregateKeywordData(spdata.getEntityId(), adGroupIds);
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

function addChartButtons(wrapper) {
    for (let { row, campaignCell } of findCampaignRows(wrapper)) {
        if ($(row).find(`.${DashboardHistoryButton.chartClass}`).length)
            continue; 

        let link = $(campaignCell).find('a')[0];
        if (!link)
            continue;

        let href = link.href;
        let campaignId = spdata.getCampaignId(href);

        const renderButtons = ga.mcatch((allowed, anonymous, summary) => {
            for (let chart of charts) {
                const target = findTargetInRow(row, chart);
                if (target)
                    addChartButtonToCell({ summary, allowed, anonymous, target, chart });
            }
        });
        renderButtons(false, true, {});

        ga.mpromise(Promise.all([spdata.getCampaignAllowed(spdata.getEntityId(), campaignId), common.getUser(), spdata.getCampaignSummaries()]))
        .then(results => {
            const [allowed, user, summaries] = results;
            const summary = summaries.find(x => x.campaignId == campaignId) || {};
            renderButtons(allowed, user.isAnon, summary);
        });
    }
}

let columns = null;
function findCampaignRows(wrapper) {
    let tableRows = $('#campaignTable tbody tr');
    if (tableRows.length)
        return Array.from(tableRows).map(x => ({ row: x, campaignCell: $(x).find('td')[1] }));

    const rowGroups = wrapper.find('[role=rowgroup]');
    columns = Array.from($(rowGroups[1]).find('span')).filter(x => x.innerText);
    const cells = $(rowGroups[3]).children('div').children('div');
    const campaignCells = $(rowGroups[2]).children('div');

    const rows = Array.from(common.pageArray(cells, columns.length));
    return rows.map((x, index) => ({ row: x, campaignCell: campaignCells[(index * 3) + 2] }));
}

function findTargetInRow(row, chart) {
    if (columns && columns.length) {
        const columnTitles = columns.map(x => x.innerText);
        const cell = row[columnTitles.indexOf(chart.columnTitle)];
        return $(cell).children()[0];
    }
    return $(row).children()[chart.column];
}

function addChartButtonToCell({ summary, allowed, anonymous, target, chart }) {
    const dataPromiseFactory = () => ga.mpromise(async function() {
        const data = summary.campaignId ? await spdata.getCampaignHistory(spdata.getEntityId(), summary.campaignId) : [];
        const deltas = common.chunkSeries(data, 'day').filter(x => x.timestamp > startTimestamp);

        const knpe = spdata.calculateKnpIncome(deltas, summary.kdp);
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
        metric: chart.metric[0],
        title: chart.label,
        dataPromiseFactory,
        latestData: summary.latestData,
    });
    ReactDOM.render(btn, container[0]);
}
