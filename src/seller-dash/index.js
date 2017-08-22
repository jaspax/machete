const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.gen.js');
const ga = require('../common/ga.js');

const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');

const endTimestamp = Date.now();
const tenDays = 15 * constants.timespan.day;
const startTimestamp = endTimestamp - tenDays;

// Map column names to data metrics
const charts = [
    { column: "Impr", label: "Impressions / day", config: {metric: 'impressions', chunk: 'day', round: true, startTimestamp} },
    { column: "Clicks", label: "Clicks / day", config: {metric: 'clicks', chunk: 'day', round: true, startTimestamp} },
    { column: "Spend", label: "Spend / day", config: {metric: 'spend', chunk: 'day', round: false, startTimestamp} },
    { column: "Orders", label: "Orders / day", config: {metric: 'salesCount', chunk: 'day', round: true, startTimestamp} },
    { column: "ACoS", label: "ACoS", config: {metric: 'acos', chunk: 'day', round: false, startTimestamp} },
    { column: "CTR", label: "CTR", config: {metric: 'ctr', chunk: 'day', round: false, startTimestamp} },
    { column: "CPC", label: "Cost per click", config: {metric: 'cpc', chunk: 'day', round: false, startTimestamp} },
    { column: "Sales", label: "Sales ($) / day", config: {metric: 'salesValue', chunk: 'day', round: false, startTimestamp} },
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

        let fetchData = calcFetchDataFunction(window.location.href, link.href);

        const campaignData = null;
        const metrics = {};
        for (let chart of charts) {
            let target = cells[columns.indexOf(chart.column)];
            if (!target)
                continue;

            if ($(target).find(`.${DashboardHistoryButton.chartClass}`).length)
                continue;

            const loadData = onComplete => {
                if (metrics[chart.config.metric])
                    return onComplete(metrics[chart.config.metric]);

                const processData = data => {
                    let chartData = common.parallelizeHistoryData(data, chart.config);
                    metrics[chart.config.metric] = formatParallelData(chartData, chart.config.metric);
                    return onComplete(metrics[chart.config.metric]);
                };

                if (campaignData) {
                    return processData(campaignData);
                }
                return fetchData(processData);
            };

            let btn = React.createElement(DashboardHistoryButton, {
                allowed: true,
                metric: chart.config.metric,
                title: chart.label,
                loadData,
            });
            const container = $('<span></span>');
            $(target).children().first().append(container);
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

function calcFetchDataFunction(locationHref, linkHref) {
    let { campaignId, adGroupId } = common.getSellerCampaignId(linkHref);
    let args = { startTimestamp, endTimestamp };

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

    return callback => {
        chrome.runtime.sendMessage(args, ga.mcatch(response => {
            if (response.error) {
                ga.merror(response.status, response.error);
                return;
            }
            callback(response.data);
        }));
    };
}
