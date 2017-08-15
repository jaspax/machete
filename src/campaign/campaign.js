const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');
require('datatables.net')(window, $);

const common = require('../common/common.js');
const ga = require('../common/ga.js');
const constants = require('../common/constants.gen.js');

const CampaignHistoryTab = require('./CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('./KeywordAnalyticsTab.jsx');

const tabClass = `machete-tab`;

const ourTabs = [
    // note: these wind up appended in the reverse order they're listed here
    {label: "Campaign History", content: "history.html", activate: generateHistoryReports, matching: /./ },
    {label: "Keyword Analytics", content: "keywordAnalytics.html", activate: generateKeywordReports, matching: /ads\/campaign/ },
];

chrome.runtime.sendMessage({
    action: 'getAllowedCampaigns',
    entityId: common.getEntityId(),
},
ga.mcatch(response => {
    if (response.error) {
        ga.merror(response.status, response.error);
    }
    const campaignAllowed = response.data.includes(common.getCampaignId());
    let makeTabsInterval = window.setInterval(ga.mcatch(() => {
        let campaignTabs = $('#campaign_detail_tab_set');
        if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
            addCampaignTabs(campaignTabs, campaignAllowed);
            window.clearInterval(makeTabsInterval);
        }
    }), 100);
}));

let metadataInterval = window.setInterval(ga.mcatch(() => {
    let campaignDataTab = $('#campaign_settings_tab_content');
    if (campaignDataTab.length == 0)
        return;

    let bookLink = campaignDataTab.find('#advertisedBookRow').find('a');
    if (bookLink.length == 0)
        return;

    let href = bookLink[0].href;
    let match = href.match(/product\/(\w+)/);
    if (match.length < 2)
        return;

    chrome.runtime.sendMessage({
        action: 'setCampaignMetadata',
        entityId: common.getEntityId(),
        campaignId: common.getCampaignId(),
        asin: match[1],
    }, ga.mcatch(response => {
        if (response.error)
             ga.merror(response.status, response.error);
    }));

    window.clearInterval(metadataInterval);
}), 100);

function generateKeywordReports(allowed, entityId, adGroupId, container) {
    const chart = React.createElement(KeywordAnalyticsTab, { 
        allowed, 
        loading: true,
        onKeywordEnabledChange: () => console.warn("shouldn't update keywords while still loading"),
        onKeywordBidChange: () => console.warn("shouldn't update keywords while still loading"),
    });
    ReactDOM.render(chart, container[0]);

    getKeywordData(entityId, adGroupId, (data) => {
        /* TODO: excluding these until we decide if/when they're actually useful
        renderSpendPieChart(data);
        renderClicksHistogram(data);
        renderImpressionsHistogram(data);
        */

        // We often don't want to display data for points with very low numbers
        // of impressions, so we set a "minimum meaningful impressions" value at
        // 10% of what would be the value if all keywords had the same number of
        // impressions.
        let totalImpressions = data.reduce((acc, val) => acc + val.impressions, 0);
        let minImpressions = totalImpressions / (data.length * 10);

        // Calculate these two derived metrics once, because we use them
        // multiple times below
        for (let kw of data) {
            kw.hasEnoughImpressions = kw.clicks && kw.impressions > minImpressions;
            kw.clickRatio = kw.clicks/kw.impressions;
        }

        let salesTopQuartile = data.sort((a, b) => b.sales - a.sales)[Math.round(data.length / 4)];
        let clickRatioSort = data.filter(x => x.hasEnoughImpressions).sort((a, b) => a.clickRatio - b.clickRatio);
        let clickRatioBottomQuartile = 0;
        let clickRatioTopQuartile = 0;
        if (clickRatioSort.length) {
            clickRatioBottomQuartile = clickRatioSort[Math.round((clickRatioSort.length - 1) * 0.25)].clickRatio;
            clickRatioTopQuartile = clickRatioSort[Math.round((clickRatioSort.length - 1) * 0.75)].clickRatio;
        }

        const worstKwTables = [{
            title: 'Keywords with ACOS over 100%',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: (x) => x.clicks && x.acos > 100,
            metricFn: (x) => x.acos,
            formatFn: (x) => x ? common.pctFmt(x) : "(no sales)",
        }, {
            title: 'Keywords with few clicks per impression',
            columnTitle: 'Clicks per 10K impressions',
            order: 'asc',
            filterFn: (x) => x.hasEnoughImpressions && x.clickRatio <= clickRatioBottomQuartile,
            metricFn: x => x.clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        }, {
            title: 'Keywords spending money without sales',
            columnTitle: 'Spend',
            order: 'desc',
            filterFn: (x) => x.clicks && !x.sales,
            metricFn: (x) => x.spend,
            formatFn: common.moneyFmt,
        }, {
            title: 'Keywords with few impressions',
            columnTitle: 'Impressions',
            order: 'asc',
            filterFn: (x) => x.impressions < minImpressions,
            metricFn: (x) => x.impressions,
            formatFn: (x) => x || 0,
        }];
        
        const bestKwTables = [{
            title: 'Keywords with high clicks-to-impressions ratio',
            columnTitle: 'Clicks per 10K impressions',
            order: 'desc',
            filterFn: (x) => x.hasEnoughImpressions && x.clickRatio >= clickRatioTopQuartile,
            metricFn: (x) => x.clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        }, {
            title: 'Keywords with low ACOS',
            columnTitle: 'ACOS',
            order: 'asc',
            filterFn: (x) => x.sales && x.acos < 100 && x.acos > 0,
            metricFn: (x) => x.acos,
            formatFn: common.pctFmt,
        }, {
            title: 'Keywords with highest profit',
            columnTitle: 'Profit (Sales - Spend)',
            order: 'desc',
            filterFn: (x) => x.sales && x.acos < 100,
            metricFn: (x) => x.sales - x.spend,
            formatFn: common.moneyFmt,
        }, {
            title: 'Keywords with highest gross sales',
            columnTitle: 'Sales',
            order: 'desc',
            filterFn: (x) => x.sales && x.sales >= salesTopQuartile.sales,
            metricFn: (x) => x.sales,
            formatFn: common.moneyFmt,
        }, {
            title: 'Disabled keywords',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: (x) => !x.enabled,
            metricFn: (x) => x.acos,
            formatFn: common.pctFmt,
        }];

        let chart = null;

        const render = () => {
            chart = React.createElement(KeywordAnalyticsTab, {
                allowed,
                loading: false,
                keywordData: data,
                worstKeywordTables: worstKwTables,
                bestKeywordTables: bestKwTables,
                onKeywordEnabledChange: (enabled, keywords) => {
                    keywordModify(updateStatus, keywords, enabled, kw => kw.enabled = enabled);
                },
                onKeywordBidChange: (bid, keywords) => {
                    keywordModify(updateBid, keywords, bid, kw => kw.bid = bid);
                },
            });
            ReactDOM.render(chart, container[0]);
        };

        const keywordModify = (modifier, keywords, value, onSuccess) => {
            modifier(keywords.map(kw => kw.id), value, (result) => {
                if (result.success) {
                    keywords.forEach(onSuccess);
                }
                else {
                    ga.merror('enabled update error:', result);
                }
                render();
            });
        };

        render();
    });
}

function generateHistoryReports(allowed, entityId, adGroupId, container) {
    const campaignId = common.getCampaignId();
    const downloadHref = `https://${constants.hostname}/api/data/${entityId}/${campaignId}/csv`;
    let tabContent = React.createElement(CampaignHistoryTab, {
        allowed,
        downloadHref,
        loadData: cb => common.getCampaignHistory(entityId, campaignId, cb),
    });
    ReactDOM.render(tabContent, container[0]);
}

function updateKeyword(keywordIdList, operation, dataValues, cb) {
    let entityId = common.getEntityId();

    // TODO: the parameters to the Amazon API imply that you can pass more than
    // 1 keyword at a time, but testing this shows that doing so just generates
    // an error. So we do it the stupid way instead, with a loop.
    let requests = [];
    for (let id of keywordIdList) {
        let postData = Object.assign({operation, entityId, keywordIds: id}, dataValues);
        requests.push($.ajax({
            url: 'https://ams.amazon.com/api/sponsored-products/updateKeywords/',
            method: 'POST',
            data: postData,
            dataType: 'json',
        }));
    }

    // TODO: in the case that we have a lot of these (bulk update), implement
    // progress feedback.
    $.when.apply($, requests)
        .done((result) => {
            result.length ? cb(Object.assign(result[0], dataValues))
                          : cb(Object.assign(result, dataValues));
        })
        .fail((error) => cb({error}));
}

function updateStatus(keywordIdList, enable, cb) {
    let operation = enable ? "ENABLE" : "PAUSE";
    return updateKeyword(keywordIdList, operation, {}, cb);
}

function updateBid(keywordIdList, bid, cb) {
    bid = parseFloat(bid).toFixed(2).toString();
    return updateKeyword(keywordIdList, 'UPDATE', {bid}, cb);
}

function addCampaignTabs(tabs, campaignAllowed) {
    let adGroupId = null;
    for (let tab of ourTabs) {
        if (!location.toString().match(tab.matching)) {
            continue;
        }

        // Fetch the url we want in order to actually embed it in the page
        $.ajax(chrome.runtime.getURL('html/'+tab.content)).then((data) => {
            let a = $(`<a href="#">${tab.label}</a>`);
            let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
            li.append(a);

            let container = $(`<div id="machete-${tab.content}" class="a-box a-box-tab a-tab-content a-hidden"></div>`);
            tabs.parent().append(container);
            container.append(data);

            a.click(ga.mcatch(function() {
                ga.mga('event', 'kword-data-tab', 'activate', tab.label);
                li.addClass('a-active');
                li.siblings().removeClass('a-active');
                tabs.parent().children('div').addClass('a-hidden');
                container.removeClass('a-hidden');

                if (window.user.isAnon) {
                    $('.machete-campaign-upgrade-required').hide();
                }
                else if (campaignAllowed) {
                    $('.machete-campaign-login-required').hide();
                    $('.machete-campaign-upgrade-required').hide();
                }

                if (tab.activate && adGroupId && !tab.hasActivated) {
                    tab.activate(campaignAllowed, common.getEntityId(), adGroupId, container);
                    tab.hasActivated = true;
                }
            }));
            $(tabs.children()[0]).after(li);
        });
    }

    // Get the ad group id from the HTML
    if (campaignAllowed) {
        let genReportsInterval = window.setInterval(() => {
            let adGroupIdInput = $('input[name=adGroupId]');
            if (!adGroupIdInput.length)
                return;
            adGroupId = adGroupIdInput[0].value;
            window.clearInterval(genReportsInterval);

            chrome.runtime.sendMessage({
                action: 'setAdGroupMetadata',
                entityId: common.getEntityId(),
                campaignId: common.getCampaignId(),
                adGroupId,
            }, ga.mcatch(response => {
                if (response.error)
                     ga.merror(response.status, response.error);
            }));

            getKeywordData(common.getEntityId(), adGroupId, () => {
                // Render the bulk update control on the main keyword list
                const allTable = $('#keywordTableControls');
                if (allTable.find('#machete-bulk-all').length == 0) {
                    // TODO: render bulkupdate

                    // Hack ourselves into the Amazon layout
                    const first = $('#keywordTableControls').children().first();
                    first.removeClass('a-span8');
                    /*
                    first.addClass('a-span4');
                    first.after(bulkAll);
                    */
                }
            });

        }, 50);
    }
}

/* TODO: commenting out until we decide we want to do something with them
function renderSpendPieChart(data) {
    let target = 100;
    let sumSpend = (acc, x) => acc + x.spend;
    let spendOverTarget = data.filter(x => x.sales && x.acos > target).reduce(sumSpend, 0);
    let spendUnderTarget = data.filter(x => x.sales && x.acos <= target).reduce(sumSpend, 0);
    let spendNoSales = data.filter(x => !x.sales).reduce(sumSpend, 0);

    let chartData = {
        values: [spendOverTarget, spendUnderTarget, spendNoSales],
        labels: ['Keywords with ACOS over 100%', 'Keywords with ACOS under 100%', 'Keywords without sales'],
        type: 'pie',
    };

    Plotly.plot('machete-spend-pie', [chartData], {height: 400, width: 400, showlegend: false});
}

function bucketize(data, binKey, valueKey) {
    let bins = {};
    for (let item of data) {
        let key = +item[binKey];
        let value = +item[valueKey];
        if (Number.isNaN(key) || Number.isNaN(value))
            continue;
        if (!bins[key])
            bins[key] = 0;
        bins[key] += value;
    }

    let binData = Object.keys(bins).map(x => parseFloat(x));
    let binValues = binData.map(x => bins[x]);

    return {x: binData, y: binValues};
}

function renderClicksHistogram(data) {
    let clickBins = bucketize(data, 'avgCpc', 'clicks');
    let chartData = {
        x: clickBins.x,
        y: clickBins.y,
        type: 'bar',
        marker: { color: 'lightblue' },
    };

    Plotly.plot('machete-clicks-histo', [chartData], {height: 400, width: 400, showlegend: false});
}

function renderImpressionsHistogram(data) {
    let clickBins = bucketize(data.filter(x => x.avgCpc), 'avgCpc', 'impressions');
    let chartData = {
        x: clickBins.x,
        y: clickBins.y,
        type: 'bar',
        marker: { color: 'lightblue' },
    };

    Plotly.plot('machete-impressions-histo', [chartData], {height: 400, width: 400, showlegend: false});
}
*/

function getKeywordData(entityId, adGroupId, cb) {
    chrome.runtime.sendMessage({
        action: 'getKeywordData', // from our server
        entityId: entityId,
        adGroupId: adGroupId,
    },
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
        }

        // If we have data, return it immediately
        if (response.data && response.data.length) {
            cb(response.data);
        }

        // After querying our own (fast) servers, query Amazon.
        chrome.runtime.sendMessage({
            action: 'requestKeywordData',
            entityId: entityId,
            adGroupId: adGroupId,
        },
        ga.mcatch(() => {
            // Try our servers again. This may fire the callback again and cause
            // us to redraw.
            chrome.runtime.sendMessage({
                action: 'getKeywordData', // from our server
                entityId: entityId,
                adGroupId: adGroupId,
            },
            ga.mcatch(response => {
                if (response.error) {
                    ga.merror(response.status, response.error);
                }
                if (response.data) {
                    cb(response.data);
                }
            }));
        }));
    }));
}
