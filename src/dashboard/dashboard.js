const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour', chunk: 'hour', round: true} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true} },
    { column: 9, label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: false} },
    { column: 11, label: "ACOS", config: {metric: 'acos', chunk: 'day', round: false} },
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
        if ($(row).attr('data-machete-ready'))
            continue;

        let cells = $(row).children();
        let link = $(cells[1]).find('a')[0];
        if (!link)
            continue;

        $(row).attr('data-machete-ready', true);

        let name = cells[1].innerText;
        let href = link.href;
        let campaignId = common.getCampaignId(href);
        let allowed = allowedCampaigns.includes(campaignId);

        getDataHistory(common.getEntityId(), campaignId, (data) => {
            for (let chart of charts) {
                let target = cells[chart.column];
                if (!target)
                    continue;

                let chartData = common.parallelizeHistoryData(data, chart.config);
                let btn = React.createElement(DashboardHistoryButton, {
                    allowed,
                    metric: chart.config.metric,
                    timestamps: chartData.timestamps,
                    data: chartData[chart.config.metric],
                    label: chart.label,
                    name,
                });
                const container = $('<span></span>');
                $(target).append(container);
                ReactDOM.render(btn, container[0]);
            }
        });
    }
}

function getDataHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            return;
        }
        cb(response.data);
    }));
}
