const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const ga = require('../common/ga.js');
const HistoryChartPopup = require('../components/HistoryChartPopup.jsx');

const chartPng = chrome.runtime.getURL('images/chart-16px.png');
const chartClass = `machete-chart-btn`;
const chartClassDisabled = `machete-chart-btn-disabled`;

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
        for (let chart of charts) {
            let cells = $(row).children();
            let target = cells[chart.column];
            if (!target || $(target).find(`.${chartClass}`).length > 0)
                continue;

            let link = $(cells[1]).find('a')[0];
            if (!link)
                continue;

            let name = cells[1].innerText;
            let href = link.href;
            let campaignId = common.getCampaignId(href);

            let btnClasses = chartClass;
            let allowed = allowedCampaigns.includes(campaignId);
            let eventCategory = 'thumbnail-enabled';
            if (!allowed) {
                btnClasses += ` ${chartClassDisabled}`;
                eventCategory = 'thumbnail-disabled';
            }
            let btn = $(`<a href="#" class="${btnClasses}"><img src="${chartPng}" /></a>`);

            btn.click(ga.mcatch(function() {
                ga.mclick(eventCategory, chart.config.metric);
                getDataHistory(common.getEntityId(), campaignId, (data) => {
                    data = common.parallelizeHistoryData(data, chart.config);
                    const historyChart = React.createElement(HistoryChartPopup, {
                        allowed,
                        anonymous: window.user.isAnon,
                        anchor: btn[0],
                        show: true,
                        name,
                        metric: chart.config.metric,
                        label: chart.label,
                        data: data[chart.config.metric],
                        timestamps: data.timestamps,
                    });
                    ReactDOM.render(historyChart, btn[0]);
                });
            }));
            $(target).append(btn);
        }
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
