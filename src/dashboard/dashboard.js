const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');

const twoWeeks = 15 * constants.timespan.day;
const startTimestamp = Date.now() - twoWeeks;
const charts = [
    { column: 6, label: "Impressions / day", metric: 'impressions' },
    { column: 7, label: "Clicks / day", metric: 'clicks' },
    { column: 8, label: "Avg CPC", metric: 'avgCpc' },
    { column: 9, label: "Spend / day", metric: 'spend' },
    { column: 10, label: "Sales / day", metric: 'salesCount' },
    { column: 11, label: "ACOS", metric: 'acos' },
];
const deltaConfig = { rate: 'day', chunk: 'day', round: false, startTimestamp };

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

        let campaignData = null;
        for (let chart of charts) {
            let target = cells[chart.column];
            if (!target)
                continue;

            const loadData = onComplete => {
                if (!allowed)
                    return onComplete(formatParallelData({}, chart.metric));
                if (campaignData)
                    return onComplete(formatParallelData(campaignData, chart.metric));

                return common.getCampaignHistory(common.getEntityId(), campaignId, data => {
                    const deltas = common.convertSnapshotsToDeltas(data, deltaConfig);
                    campaignData = common.parallelizeSeries(deltas);
                    onComplete(formatParallelData(campaignData, chart.metric));
                });
            };

            let btn = React.createElement(DashboardHistoryButton, {
                allowed,
                metric: chart.metric,
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
        timestamp: data.timestamp || [],
        data: data[name] || [], 
        name,
    };
}
