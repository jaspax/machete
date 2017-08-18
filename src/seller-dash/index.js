const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.gen.js');
const ga = require('../common/ga.js');

const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');

// Map column names to data metrics
const endTimestamp = Date.now();
const tenDays = 10 * constants.timespan.day;
const startTimestamp = endTimestamp - tenDays;

const charts = [
    { column: "Impr", label: "Impressions / day", config: {metric: 'impressions', rate: 'day', chunk: 'day', round: true, startTimestamp} },
    { column: "Clicks", label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true, startTimestamp} },
    { column: "Spend", label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false, startTimestamp} },
    { column: "Orders", label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: true, startTimestamp} },
    { column: "ACoS", label: "ACoS", config: {metric: 'acos', chunk: 'day', round: false, startTimestamp} },
    { column: "CTR", label: "CTR", config: {metric: 'ctr', chunk: 'day', round: false, startTimestamp} },
    { column: "CPC", label: "Cost per click", config: {metric: 'cpc', chunk: 'day', round: false, startTimestamp} },
    { column: "Sales", label: "Sales", config: {metric: 'salesValue', chunk: 'day', round: false, startTimestamp} },
];

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

function addChartButtons(columns, rows) {
    for (let row of rows) {
        let cells = $(row).find('.sspa-table-cell-container');
        if (cells.length == 0)
            continue;

        let link = $(cells[2]).find('a')[0];
        if (!link)
            continue;

        let href = link.href;
        let campaignId = common.getSellerCampaignId(href);

        const campaignData = null;
        const campaignMetrics = {};
        for (let chart of charts) {
            let target = cells[columns.indexOf(chart.column)];
            if (!target)
                continue;

            if ($(target).find(`.${DashboardHistoryButton.chartClass}`).length)
                continue;

            const loadData = onComplete => {
                if (campaignMetrics[chart.config.metric])
                    return onComplete(campaignMetrics[chart.config.metric]);
                if (campaignData) {
                    let chartData = common.parallelizeHistoryData(campaignData, chart.config);
                    campaignMetrics[chart.config.metric] = formatParallelData(chartData, chart.config.metric);
                    return onComplete(campaignMetrics[chart.config.metric]);
                }

                return getSellerCampaignHistory(campaignId, data => {
                    let chartData = common.parallelizeHistoryData(data, chart.config);
                    campaignMetrics[chart.config.metric] = formatParallelData(chartData, chart.config.metric);
                    onComplete(campaignMetrics[chart.config.metric]);
                });
            };

            let btn = React.createElement(DashboardHistoryButton, {
                allowed: true,
                metric: chart.config.metric,
                title: chart.label,
                loadData,
            });
            const container = $('<span></span>');
            $(target).append(container);
            ReactDOM.render(btn, container[0]);
        }
    }
}

function getSellerCampaignHistory(campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getCampaignDataRange',
        campaignId,
        startTimestamp,
        endTimestamp,
    },
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            return;
        }
        cb(response.data);
    }));
}

function formatParallelData(data, name) {
    return { 
        timestamps: data.timestamps, 
        data: data[name], 
        name,
    };
}
