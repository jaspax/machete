const $ = require('jquery');
const _ = require('lodash');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.gen.js');
const ga = require('../common/ga.js');

const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const KeywordAnalysis = require('../components/KeywordAnalysis.jsx');

const now = Date.now();
const twoWeeks = 15 * constants.timespan.day;
const ninetyDays = 91 * constants.timespan.day;
const twoWeeksAgo = now - twoWeeks;
const ninetyDaysAgo = now - ninetyDays;

const tabClass = `machete-tab`;

// Map column names to data metrics
const charts = [
    { column: "Impr", label: "Impressions / day", config: {metric: 'impressions', chunk: 'day', round: true} },
    { column: "Clicks", label: "Clicks / day", config: {metric: 'clicks', chunk: 'day', round: true} },
    { column: "Spend", label: "Spend / day", config: {metric: 'spend', chunk: 'day', round: false} },
    { column: "Orders", label: "Orders / day", config: {metric: 'salesCount', chunk: 'day', round: true} },
    { column: "ACoS", label: "ACoS", config: {metric: 'acos', chunk: 'day', round: false} },
    { column: "CTR", label: "CTR", config: {metric: 'ctr', chunk: 'day', round: false} },
    { column: "CPC", label: "Cost per click", config: {metric: 'cpc', chunk: 'day', round: false} },
    { column: "Sales", label: "Sales ($) / day", config: {metric: 'salesValue', chunk: 'day', round: false} },
];

// Tabs that we want to add to the regular tab places
const ourTabs = [
    // note: these wind up appended in the reverse order they're listed here
    // {label: "Campaign History", activate: generateHistoryReports, matching: /./ },
    {label: "Keyword Analytics", activate: generateKeywordReports, matching: /ads\/campaign/ },
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

let makeTabsInterval = window.setInterval(ga.mcatch(() => {
    let campaignTabs = $('.a-tab-heading');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
        window.clearInterval(makeTabsInterval);
    }
}), 100);

function addCampaignTabs(tabs) {
    for (let tab of ourTabs) {
        /* Probably not going to keep doing this?
        if (!location.toString().match(tab.matching)) {
            continue;
        }
        */

        // Create the actual Tab control and embed it into the 
        let a = $(`<a href="javascript:void(0);">${tab.label}</a>`);
        let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
        li.append(a);

        let container = $(`<div class="a-box a-box-tab a-tab-content a-hidden"></div>`);
        tabs.parent().after(container);

        a.click(ga.mcatch(function(evt) {
            evt.preventDefault();
            ga.mga('event', 'kword-data-tab', 'activate', tab.label);
            li.addClass('a-active');
            li.siblings().removeClass('a-active');
            tabs.parent().siblings('div').addClass('a-hidden');
            container.removeClass('a-hidden');

            if (tab.activate && !tab.hasActivated) {
                tab.activate(container);
                tab.hasActivated = true;
            }
        }));

        tabs.parent().append(li);
    }
}

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
    let args = { startTimestamp: twoWeeksAgo, endTimestamp: now };

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

function getKeywordDataAggregate(onComplete) {
    let { campaignId, adGroupId } = common.getSellerCampaignId(window.location.href);

    chrome.runtime.sendMessage({
        action: 'getKeywordDataRange',
        campaignId,
        adGroupId,
        startTimestamp: ninetyDaysAgo,
        endTimestamp: now,
    }, ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            return;
        }

        const keywords = {};
        for (const record of response.data) {
            const kw = record.keyword;
            if (!keywords[kw])
                keywords[kw] = {};
            _.each(_.keys(record), key => {
                if (['impressions', 'clicks', 'sales', 'spend'].includes(key)) {
                    if (isNaN(keywords[kw][key]))
                        keywords[kw][key] = 0;
                    keywords[kw][key] += record[key];
                }
                else {
                    keywords[kw][key] = record[key];
                }
            });
        }

        onComplete(_.values(keywords));
    }));
}

function generateKeywordReports(container) {
    const chart = React.createElement(KeywordAnalysis, { 
        allowed: true, // assume true until we know otherwise
        loading: true,
        keywordData: [],
        updateStatus: () => console.warn("shouldn't update keywords while still loading"),
        updateBid: () => console.warn("shouldn't update keywords while still loading"),
    });
    ReactDOM.render(chart, container[0]);

    getKeywordDataAggregate(data => {
        const chart = React.createElement(KeywordAnalysis, { 
            allowed: true, // assume true until we know otherwise
            loading: false,
            keywordData: data,
            updateStatus: () => console.warn("TODO: updated status"),
            updateBid: () => console.warn("TODO: update bid"),
        });
        ReactDOM.render(chart, container[0]);
    });
}
