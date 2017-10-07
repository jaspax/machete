const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');
const co = require('co');

const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const CampaignHistoryTab = require('../components/CampaignHistoryTab.jsx');
const tabber = require('../components/tabber.js');

const twoWeeks = 15 * constants.timespan.day;
const startTimestamp = Date.now() - twoWeeks;
const charts = [
    { column: 6, label: "Impressions / day", metric: 'impressions' },
    { column: 7, label: "Clicks / day", metric: 'clicks' },
    { column: 8, label: "Avg CPC", metric: 'avgCpc' },
    { column: 9, label: "Spend / day", metric: 'spend' },
    { column: 10, label: "Sales ($) / day", metric: 'salesValue' },
    { column: 11, label: "ACOS", metric: 'acos' },
];
const deltaConfig = { rate: 'day', chunk: 'day', startTimestamp };

window.setInterval(ga.mcatch(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let wrapper = $('#campaignTable_wrapper');
    addTabs(wrapper);
}), 100);

const campaignSummaryPromise = co(function*() {
    const entityId = common.getEntityId();
    const summaries = yield common.getCampaignSummary(entityId);
    const allowed = yield Promise.all(summaries.map(s => common.getCampaignAllowed(entityId, s.campaignId)));
    const summaryAllowed = summaries.filter((item, index) => allowed[index]);
    return summaryAllowed;
});

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
        activate: (entityId, historyContainer) => {
            let aggContent = React.createElement(CampaignHistoryTab, {
                allowed: true,
                anonymous: false,
                downloadHref: '',
                dataPromise: co(function*() {
                    const summaries = yield campaignSummaryPromise;
                    const histories = yield Promise.all(summaries.map(s => common.getCampaignHistory(entityId, s.campaignId)));
                    const deltas = histories.map(h => common.convertSnapshotsToDeltas(h, { rate: 'day', chunk: 'day' }));
                    const aggSeries = common.aggregateSeries(deltas, { chunk: 'day' });
                    return aggSeries;
                }),
            });
            ReactDOM.render(aggContent, historyContainer[0]);
        },
    });
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
        let campaignId = common.getCampaignId(href);

        const renderButtons = (allowed, anonymous) => {
            for (let chart of charts) {
                let target = cells[chart.column];
                if (!target)
                    continue;

                const dataPromiseFactory = () => co(function*() {
                    if (!allowed)
                        return formatParallelData({}, chart.metric);

                    const data = yield common.getCampaignHistory(common.getEntityId(), campaignId);
                    const deltas = common.convertSnapshotsToDeltas(data, deltaConfig);
                    const campaignData = common.parallelizeSeries(deltas);
                    return formatParallelData(campaignData, chart.metric);
                });

                let container = $(target).find('.machete-dash-container');
                if (!container.length) {
                    container = $('<span class="machete-dash-container"></span>');
                    $(target).append(container);
                }

                let btn = React.createElement(DashboardHistoryButton, {
                    allowed,
                    anonymous,
                    metric: chart.metric,
                    title: chart.label,
                    dataPromiseFactory,
                });
                ReactDOM.render(btn, container[0]);
            }
        };

        renderButtons(false, true);

        Promise.all([common.getCampaignAllowed(common.getEntityId(), campaignId), common.getUser()])
        .then(results => {
            const [allowed, user] = results;
            renderButtons(allowed, user.isAnon);
        });
    }
}

function formatParallelData(data, name) {
    return { 
        timestamp: data.timestamp || [],
        data: data[name] || [], 
        name,
    };
}
