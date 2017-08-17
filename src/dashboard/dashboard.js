const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.gen.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');

const tenDays = 10 * constants.timespan.day;
const startTimestamp = Date.now() - tenDays;
const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour', chunk: 'hour', round: true, startTimestamp} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true, startTimestamp} },
    { column: 9, label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false, startTimestamp} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: false, startTimestamp} },
    { column: 11, label: "ACOS", config: {metric: 'acos', chunk: 'day', round: false, startTimestamp} },
];


chrome.runtime.sendMessage({
    action: 'getAllowedCampaigns',
    entityId: common.getEntityId(),
},
ga.mcatch(response => {
    if (response.error) {
        ga.merror(response.status, response.error);
    }
    const allowedCampaigns = response.data;
    window.setInterval(ga.mcatch(() => {
        let tableRows = $('#campaignTable tbody tr');
        addChartButtons(tableRows, allowedCampaigns);
    }), 100);
}));

const templateUrl = chrome.runtime.getURL('html/templates.html');
$.ajax(templateUrl, {
    method: 'GET',
    success: (data) => {
        let dashboard = $('#campaignDashboard');
        dashboard.append(data);
    },
});

function addChartButtons(rows, allowedCampaigns) {
    for (let row of rows) {
        if ($(row).find(`.${DashboardHistoryButton.chartClass}`).length)
            continue; 

        let cells = $(row).children();
        let link = $(cells[1]).find('a')[0];
        if (!link)
            continue;

        let href = link.href;
        let campaignId = common.getCampaignId(href);
        let allowed = allowedCampaigns.includes(campaignId);

        const campaignData = null;
        const campaignMetrics = {};
        for (let chart of charts) {
            let target = cells[chart.column];
            if (!target)
                continue;

            const loadData = onComplete => {
                if (!allowed)
                    return onComplete([]);
                if (campaignMetrics[chart.config.metric])
                    return onComplete(campaignMetrics[chart.config.metric]);
                if (campaignData) {
                    let chartData = common.parallelizeHistoryData(campaignData, chart.config);
                    campaignMetrics[chart.config.metric] = formatParallelData(chartData, chart.config.metric);
                    return onComplete(campaignMetrics[chart.config.metric]);
                }

                return common.getCampaignHistory(common.getEntityId(), campaignId, (data) => {
                    let chartData = common.parallelizeHistoryData(data, chart.config);
                    campaignMetrics[chart.config.metric] = formatParallelData(chartData, chart.config.metric);
                    onComplete(campaignMetrics[chart.config.metric]);
                });
            };

            let btn = React.createElement(DashboardHistoryButton, {
                allowed,
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

function formatParallelData(data, name) {
    return { 
        timestamps: data.timestamps, 
        data: data[name], 
        name,
    };
}
