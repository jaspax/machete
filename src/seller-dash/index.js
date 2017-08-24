const $ = require('jquery');
const _ = require('lodash');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const constants = require('../common/constants.gen.js');
const ga = require('../common/ga.js');

const LoadingNotice = require('./LoadingNotice.jsx');
const DashboardHistoryButton = require('../components/DashboardHistoryButton.jsx');
const KeywordAnalysis = require('../components/KeywordAnalysis.jsx');
const CampaignHistoryTab = require('../campaign/CampaignHistoryTab.jsx');

const now = Date.now();
const twoWeeks = 15 * constants.timespan.day;
const ninetyDays = 91 * constants.timespan.day;
const twoWeeksAgo = now - twoWeeks;
const ninetyDaysAgo = now - ninetyDays;

const tabClass = `machete-tab`;

// Map column names to data metrics
const charts = [
    { column: "Impr", label: "Impressions / day", metric: 'impressions' },
    { column: "Clicks", label: "Clicks / day", metric: 'clicks' },
    { column: "Spend", label: "Spend / day", metric: 'spend', },
    { column: "Orders", label: "Orders / day", metric: 'salesCount', },
    { column: "ACoS", label: "ACoS", metric: 'acos' },
    { column: "CTR", label: "CTR", metric: 'ctr' },
    { column: "CPC", label: "Cost per click ($)", metric: 'cpc' },
    { column: "Sales", label: "Sales ($) / day", metric: 'salesValue' },
];

const setSessionPromise = new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'setSession', }, (response) => {
        if (response.error)
            return reject(response.error);
        return resolve();
    });
});

let loadingInterval = window.setInterval(() => {
    const navbar = $('.sspa-navigation-bar');
    if (!navbar.length)
        return;

    let container = navbar.find(LoadingNotice.className).parent();
    if (!container.length) {
        container = $('<div style="position: absolute; width: 100%"></div>');
        navbar.prepend(container);
    }

    const loading = React.createElement(LoadingNotice, {});
    ReactDOM.render(loading, container[0]);

    setSessionPromise.then(() => container.remove());
    window.clearInterval(loadingInterval);
}, 100);

// Add in the Machete link to the top bar
let user = null;
chrome.runtime.sendMessage({ action: 'getUser' }, response => {
    if (response.error) {
        ga.merror(response.error);
        return;
    }
    user = response.data;
    user.isAnon = user.email == 'anon-user-email';
});

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

window.setInterval(ga.mcatch(() => {
    let tabs = $('.a-tab-heading');
    if (tabs.parent().find(`.${tabClass}`).length)
        return;

    if (window.location.href.match(/ad_group\/A\w+\//)) {
        // On the ad group page. Add the keyword analytics page
        injectTab(tabs, "Keyword Analytics", generateKeywordReports);
    }
    else if (window.location.href.match(/ad_groups\//)) {
        // On a history page, add that tab in
        injectTab(tabs, "Campaign History", generateCampaignHistory);
    }
}), 100);

function injectTab(tabs, label, activate) {
    // Create the actual Tab control and embed it into the existing tab list
    let a = $(`<a href="javascript:void(0);">${label}</a>`);
    let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
    li.append(a);

    let container = $(`<div class="a-box a-box-tab a-tab-content a-hidden"></div>`);
    tabs.parent().after(container);

    let hasActivated = false;
    a.click(ga.mcatch(function(evt) {
        evt.preventDefault();
        ga.mga('event', 'kword-data-tab', 'activate', label);
        li.addClass('a-active');
        li.siblings().removeClass('a-active');
        tabs.parent().siblings('div').addClass('a-hidden');
        container.removeClass('a-hidden');

        if (activate && !hasActivated) {
            activate(container);
            hasActivated = true;
        }
    }));

    tabs.parent().append(li);
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

        let campaignData = null;
        for (let chart of charts) {
            let target = cells[columns.indexOf(chart.column)];
            if (!target)
                continue;

            if ($(target).find(`.${DashboardHistoryButton.chartClass}`).length)
                continue;

            const loadData = onComplete => {
                if (campaignData)
                    return onComplete(formatParallelData(campaignData, chart.metric));

                return fetchData(data => {
                    campaignData = common.parallelizeSeries(data);
                    return onComplete(formatParallelData(campaignData, chart.metric));
                });
            };

            let btn = React.createElement(DashboardHistoryButton, {
                allowed: user && !user.isAnon,
                metric: chart.metric,
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
        timestamp: data.timestamp, 
        data: data[name], 
        name,
    };
}

function calcFetchDataFunction(locationHref, linkHref, startTimestamp, endTimestamp) {
    let { campaignId, adGroupId } = common.getSellerCampaignId(linkHref);
    let args = { startTimestamp: startTimestamp || twoWeeksAgo, endTimestamp: endTimestamp || now };

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
        for (const record of response.data.sort((a, b) => a.timestamp - b.timestamp)) {
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

        const values = _.values(keywords);
        for (const kw of values) {
            kw.acos = kw.sales ? 100 * kw.spend/kw.sales : null;
            kw.ctr = kw.impressions ? 100* kw.clicks/kw.impressions : null;
            kw.avgCpc = kw.clicks ? kw.spend/kw.clicks : null;
        }

        onComplete(values);
    }));
}

function generateCampaignHistory(container) {
    const content = React.createElement(CampaignHistoryTab, {
        allowed: user && !user.isAnon,
        downloadHref: '',
        loadData: calcFetchDataFunction(window.location.href, window.location.href, 1),
    });
    ReactDOM.render(content, container[0]);
}

function generateKeywordReports(container) {
    let content = React.createElement(KeywordAnalysis, { 
        allowed: user && !user.isAnon, // assume true until we know otherwise
        loading: true,
        keywordData: [],
        updateStatus: () => console.warn("shouldn't update keywords while still loading"),
        updateBid: () => console.warn("shouldn't update keywords while still loading"),
    });
    ReactDOM.render(content, container[0]);

    getKeywordDataAggregate(data => {
        content = React.createElement(KeywordAnalysis, { 
            allowed: user && !user.isAnon,
            loading: false,
            keywordData: data,
            updateStatus,
            updateBid,
        });
        ReactDOM.render(content, container[0]);
    });
}

function updateKeyword(data, cb) {
    $.ajax({
        url: 'https://sellercentral.amazon.com/hz/cm/keyword/update',
        method: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json',
        dataType: 'json',
    })
    .then(() => cb({success: true}))
    .catch(error => cb({error}));
}

function updateStatus(keywordIds, enabled, cb) {
    const status = enabled ? 'ENABLED' : 'PAUSED';
    const postData = { entities: keywordIds.map(id => ({ id, status })) };
    updateKeyword(postData, cb);
}

function updateBid(keywordIds, bid, cb) {
    const postData = { entities: keywordIds.map(id => ({ id, bid })) };
    updateKeyword(postData, cb);
}
