const $ = require('jquery');
const React = require('react');
const ReactDOM = require('react-dom');

const common = require('../common/common.js');
const ga = require('../common/ga.js');
const constants = require('../common/constants.gen.js');

const CampaignHistoryTab = require('./CampaignHistoryTab.jsx');
const KeywordAnalyticsTab = require('./KeywordAnalyticsTab.jsx');
const KeywordBulkUpdate = require('./KeywordBulkUpdate.jsx');

const tabClass = `machete-tab`;

const ourTabs = [
    // note: these wind up appended in the reverse order they're listed here
    {label: "Campaign History", activate: generateHistoryReports, matching: /./ },
    {label: "Keyword Analytics", activate: generateKeywordReports, matching: /ads\/campaign/ },
];

let allowedPromise = new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
        action: 'getAllowedCampaigns',
        entityId: common.getEntityId(),
    },
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            reject(response.error);
        }
        resolve(response.data.includes(common.getCampaignId()));
    }));
});

let adGroupPromise = new Promise(resolve => {
    let adGroupInterval = window.setInterval(() => {
        let adGroupIdInput = $('input[name=adGroupId]');
        if (!adGroupIdInput.length)
            return;

        let adGroupId = adGroupIdInput[0].value;
        window.clearInterval(adGroupInterval);

        chrome.runtime.sendMessage({
            action: 'setAdGroupMetadata',
            entityId: common.getEntityId(),
            campaignId: common.getCampaignId(),
            adGroupId,
        }, ga.mcatch(response => {
            if (response.error)
                 ga.merror(response.status, response.error);
        }));
        resolve(adGroupId);
    }, 100);
});

let keywordDataPromise = Promise.all([allowedPromise, adGroupPromise])
.then(results => new Promise((resolve, reject) => {
    let [allowed, adGroupId] = results;
    if (!allowed) {
        resolve([]);
    }
    getKeywordData(common.getEntityId(), adGroupId, resolve, reject);
}));

let makeTabsInterval = window.setInterval(ga.mcatch(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
        window.clearInterval(makeTabsInterval);
    }
}), 100);

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

function addCampaignTabs(tabs) {
    for (let tab of ourTabs) {
        if (!location.toString().match(tab.matching)) {
            continue;
        }

        // Create the actual Tab control and embed it into the 
        let a = $(`<a href="#">${tab.label}</a>`);
        let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
        li.append(a);

        let container = $(`<div id="machete-${tab.content}" class="a-box a-box-tab a-tab-content a-hidden"></div>`);
        tabs.parent().append(container);

        a.click(ga.mcatch(function() {
            ga.mga('event', 'kword-data-tab', 'activate', tab.label);
            li.addClass('a-active');
            li.siblings().removeClass('a-active');
            tabs.parent().children('div').addClass('a-hidden');
            container.removeClass('a-hidden');

            if (tab.activate && !tab.hasActivated) {
                tab.activate(common.getEntityId(), container);
                tab.hasActivated = true;
            }
        }));
        $(tabs.children()[0]).after(li);
    }

    allowedPromise.then(allowed => {
        if (allowed) {
            // Render the bulk update control on the main keyword list
            const allTable = $('#keywordTableControls');
            if (allTable.find('#machete-bulk-all').length == 0) {
                // Hack ourselves into the Amazon layout
                const bulkContainer = $('<div class="a-span4 machete-kwupdate-all" id="machete-bulk-all"></div>');
                const first = $('#keywordTableControls').children().first();
                first.removeClass('a-span8');
                first.addClass('a-span4');
                first.after(bulkContainer);
                keywordDataPromise.then(data => generateBulkUpdate(bulkContainer, data));
            }
        }
    });
}

function generateKeywordReports(entityId, container) {
    const chart = React.createElement(KeywordAnalyticsTab, { 
        allowed: true, // assume true until we know otherwise
        loading: true,
        onKeywordEnabledChange: () => console.warn("shouldn't update keywords while still loading"),
        onKeywordBidChange: () => console.warn("shouldn't update keywords while still loading"),
    });
    ReactDOM.render(chart, container[0]);

    Promise.all([allowedPromise, keywordDataPromise]).then(results => {
        let [allowed, data] = results;
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

function generateHistoryReports(entityId, container) {
    const campaignId = common.getCampaignId();
    const downloadHref = `https://${constants.hostname}/api/data/${entityId}/${campaignId}/csv`;

    allowedPromise.then(allowed => {
        let tabContent = React.createElement(CampaignHistoryTab, {
            allowed,
            downloadHref,
            loadData: cb => common.getCampaignHistory(entityId, campaignId, cb),
        });
        ReactDOM.render(tabContent, container[0]);
    });
}

function generateBulkUpdate(container, data) {
    const bulkUpdate = React.createElement(KeywordBulkUpdate, {
        data,
        onEnabledChange: (enabled, keywords) => {
            updateStatus(keywords.map(kw => kw.id), enabled, () => window.location.reload());
        },
        onBidChange: (bid, keywords) => {
            updateBid(keywords.map(kw => kw.id), bid, () => window.location.reload());
        },
    });
    ReactDOM.render(bulkUpdate, container[0]);
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

function getKeywordData(entityId, adGroupId, resolve, reject) {
    chrome.runtime.sendMessage({
        action: 'requestKeywordData', // from Amazon's servers
        entityId: entityId,
        adGroupId: adGroupId,
    },
    ga.mcatch(() => {
        chrome.runtime.sendMessage({
            action: 'getKeywordData', // from our server
            entityId: entityId,
            adGroupId: adGroupId,
        },
        ga.mcatch(response => {
            if (response.error) {
                ga.merror(response.status, response.error);
                return reject(response.error);
            }
            return resolve(response.data || []);
        }));
    }));
}
