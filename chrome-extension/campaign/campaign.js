const tabClass = `${prefix}-tab`;
const chartId = `${prefix}-kwchart`;

const ourTabs = [
    // note: these wind up appended in the reverse order they're listed here
    {label: "Campaign History", content: "history.html"},
    {label: "Keyword Analytics", content: "keywordAnalytics.html"},
];

let hasAdGroup = false;
window.setInterval(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
    }

    if (!hasAdGroup) {
        let adGroupIdInput = $('input[name=adGroupId]');
        if (adGroupIdInput.length) {
            let adGroupId = adGroupIdInput.val();
            generateKeywordReports(adGroupId);
            generateHistoryReports();
            hasAdGroup = true;
        }
    }
}, 100);

function generateKeywordReports(adGroupId) {
    getKeywordData(getEntityId(), adGroupId, (data) => {
        let enabledKws = data.filter(kw => kw.enabled);

        renderKeywordChart(transformKeywordData(enabledKws), {});
        /* TODO: excluding these until we decide if/when they're actually useful
        renderSpendPieChart(enabledKws);
        renderClicksHistogram(enabledKws);
        renderImpressionsHistogram(enabledKws);
        */

        // We often don't want to display data for points with very low numbers
        // of impressions, so we set a "minimum meaningful impressions" value at
        // 10% of what would be the value if all keywords had the same number of
        // impressions.
        let totalImpressions = enabledKws.reduce((acc, val) => acc + val.impressions, 0);
        let minImpressions = totalImpressions / (enabledKws.length * 10);

        let hasEnoughImpressions = x => x.clicks && x.impressions > minImpressions;
        let clickRatio = x => x.clicks/x.impressions;

        let salesTopQuartile = enabledKws.sort((a, b) => b.sales - a.sales)[Math.round(enabledKws.length / 4)];
        let clickRatioSort = enabledKws.filter(hasEnoughImpressions).sort((a, b) => clickRatio(a) - clickRatio(b));
        let clickRatioBottomQuartile = clickRatioSort[Math.round(clickRatioSort.length * 0.25)];
        let clickRatioTopQuartile = clickRatioSort[Math.round(clickRatioSort.length * 0.75)];

        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-acos',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: (x) => x.clicks && x.acos > 100,
            metricFn: (x) => x.acos,
            formatFn: (x) => x ? `${x}%` : "(no sales)",
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-click-ratio',
            columnTitle: 'Clicks per 10K impressions',
            order: 'asc',
            filterFn: (x) => hasEnoughImpressions(x) && clickRatio(x) <= clickRatio(clickRatioBottomQuartile),
            metricFn: clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(enabledKws, {
            selector: '#ams-unlocked-spend',
            columnTitle: 'Spend',
            order: 'desc',
            filterFn: (x) => x.clicks && !x.sales,
            metricFn: (x) => x.spend,
            formatFn: moneyFmt,
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-impressions',
            columnTitle: 'Impressions',
            order: 'asc',
            filterFn: (x) => x.impressions < minImpressions,
            metricFn: (x) => x.impressions,
            formatFn: (x) => x || 0,
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-high-click-ratio',
            columnTitle: 'Clicks per 10K impressions',
            order: 'desc',
            filterFn: (x) => hasEnoughImpressions(x) && clickRatio(x) >= clickRatio(clickRatioTopQuartile),
            metricFn: clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-low-acos',
            columnTitle: 'ACOS',
            order: 'asc',
            filterFn: (x) => x.sales && x.acos < 100 && x.acos > 0,
            metricFn: (x) => x.acos,
            formatFn: (x) => `${x}%`,
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-high-profit',
            columnTitle: 'Profit (Sales - Spend)',
            order: 'desc',
            filterFn: (x) => x.sales && x.acos < 100,
            metricFn: (x) => x.sales - x.spend,
            formatFn: moneyFmt,
        });
        renderKeywordTable(enabledKws, { 
            selector: '#ams-unlocked-high-sales',
            columnTitle: 'Sales',
            order: 'desc',
            filterFn: (x) => x.sales && x.sales >= salesTopQuartile.sales,
            metricFn: (x) => x.sales,
            formatFn: moneyFmt,
        });

        // This is the only one that uses disabled keywords
        renderKeywordTable(data, { 
            selector: '#ams-unlocked-paused',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: (x) => !x.enabled,
            metricFn: (x) => x.acos,
            formatFn: (x) => `${x}%`,
        });
    });
}

function generateHistoryReports() {
    getCampaignHistory(getEntityId(), getCampaignId(), (data) => {
        let metrics = ['impressions', 'clicks', 'salesCount'];
        data = parallelizeHistoryData(data, {rate: 'day', metrics});
        renderHistoryChart(data, {
            labels: {
                impressions: 'Impressions',
                clicks: 'Clicks',
                salesCount: 'Sales',
            },
        });
    });
}

function renderHistoryChart(data, opts) {
    let series = [];
    for (let key of Object.keys(data)) {
        if (key == 'timestamps')
            continue;

        series.push({
          x: data.timestamps,
          y: data[key],
          mode: 'lines+markers',
          name: opts.labels[key],
          connectgaps: true
        });
    }

    let historyChartId = 'ams-unlocked-campaign-history-chart';

    var layout = {
      width: 840,
      height: 600,
      autosize: true,
    };

    Plotly.newPlot(historyChartId, series, layout);
};


function updateKeyword(keywordIdList, operation, dataValues, cb) {
    let entityId = getEntityId();
    
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
    return updateKeyword(keywordIdList, 'UPDATE', {bid}, cb);
}

function addCampaignTabs(tabs) {
    for (let tab of ourTabs) {
        let a = $(`<a href="#">${tab.label}</a>`);
        let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
        li.append(a);

        let container = $(`<div id="ams-unlocked-${tab.content}" class="a-box a-box-tab a-tab-content a-hidden"></div>`);
        tabs.parent().append(container);

        a.click(function(evt) {
            li.addClass('a-active');
            li.siblings().removeClass('a-active');
            tabs.parent().children('div').addClass('a-hidden');
            container.removeClass('a-hidden');
        });
        $(tabs.children()[0]).after(li);

        // Fetch the url we want in order to actually embed it in the page
        $.ajax({
            url: chrome.runtime.getURL('campaign/'+tab.content),
            success: (data, textStatus, xhr) => container.append(data),
        });
    }
}

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

    Plotly.plot('ams-unlocked-spend-pie', [chartData], {height: 400, width: 400, showlegend: false});
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

    Plotly.plot('ams-unlocked-clicks-histo', [chartData], {height: 400, width: 400, showlegend: false});
}

function renderImpressionsHistogram(data) {
    let clickBins = bucketize(data.filter(x => x.avgCpc), 'avgCpc', 'impressions');
    let chartData = {
        x: clickBins.x,
        y: clickBins.y,
        type: 'bar',
        marker: { color: 'lightblue' },
    };

    Plotly.plot('ams-unlocked-impressions-histo', [chartData], {height: 400, width: 400, showlegend: false});
}

function getCampaignHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    (response) => cb(response.data));
}

function getKeywordData(entityId, adGroupId, cb) {
    chrome.runtime.sendMessage({
        action: 'getKeywordData', // from our server
        entityId: entityId,
        adGroupId: adGroupId,
    },
    (response) => {
        // If we have data, return it immediately
        if (response.data.length) {
            cb(response.data);
        }

        // After querying our own (fast) servers, query Amazon. TODO: this is
        // gonna get moved to the cloud
        chrome.runtime.sendMessage({
            action: 'requestKeywordData',
            entityId: entityId,
            adGroupId: adGroupId,
        }, 
        (amsResponse) => {
            // Try our servers again. This may fire the callback again and cause
            // us to redraw.
            chrome.runtime.sendMessage({
                action: 'getKeywordData', // from our server
                entityId: entityId,
                adGroupId: adGroupId,
            }, 
            (response) => {
                cb(response.data);
            });
        });
    });
}; 

function transformKeywordData(data, opt) {
    let kws = {
        kw: [],
        impressions: [],
        spend: [],
        sales: [],
        clicks: [],
        acos: [],
        avgCpc: [],
    };
    for (let k of data) {
        kws.kw.push(k.keyword);
        kws.impressions.push(k.impressions);
        kws.clicks.push(k.clicks);
        kws.spend.push(k.spend);
        kws.sales.push(k.sales);
        kws.acos.push(k.acos);
        kws.avgCpc.push(k.avgCpc);
    }

    return kws;
}

function renderKeywordChart(kws, opt) {
    let chartData = {
        mode: 'markers',
        x: kws.avgCpc,
        y: kws.clicks,
        text: kws.kw.map((kw, i) => 
            `"${kw}"<br />Impressions: ${kws.impressions[i]}<br />Clicks: ${kws.clicks[i]}<br />Avg CPC: ${moneyFmt(kws.avgCpc[i])}<br />Avg COS: ${kws.acos[i]}%`),
        hoverinfo: 'text',
        marker: {
            sizemode: 'diameter',
            size: kws.impressions.map(x => (Math.log2(x)+1) * 2),
            color: kws.acos,
            colorscale: [[0, 'rgb(0, 255, 0)'], [0.5, 'rgb(255, 255, 0)'], [1, 'rgb(255, 0, 0)']],
        },
    };
    let layout = {
        xaxis: {title: 'Average CPC'},
        yaxis: {title: 'Number of clicks'},
        margin: {t: 20},
        height: 600,
        width: $('.a-box-inner').width(),
        hovermode: 'closest',
        showlegend: false,
    };
    Plotly.plot(chartId, [chartData], layout, {showLink: false});
}

function renderKeywordTable(data, opts) {
    let container = $(opts.selector);
    container.empty();

    data = data.filter(opts.filterFn ? opts.filterFn : x => true);
    
    // Render the bulk update button -- pass in a copy of the array since we're
    // going to modify it below.
    let bulk = renderBulkUpdate([].concat(data), opts);
    container.append(bulk);

    let table = cloneTemplate("ams-unlocked-kwtable");
    container.append(table);

    let formatFn = opts.formatFn ? opts.formatFn : x => x;
    data = data.map(x => [
        x.keyword, 
        formatFn(opts.metricFn(x)), 
        renderKeywordStatus(x),
        renderKeywordBid(x),
    ]);

    table.DataTable({
        data: data,
        order: [[1, opts.order || 'asc']],
        columns: [
            { title: "Keyword" }, 
            { title: opts.columnTitle }, 
            { title: "Status" },
            { title: "Bid" },
        ],
    });

    table.width('100%'); // TODO: figure out why DataTables is setting this to 0
}

$(document).on('click', '.ams-unlocked-kwstatus', function() {
    let keyword = JSON.parse($(this).attr('data-ams-unlocked-keyword'));
    $(this).find('.a-button').hide();
    $(this).find('.loading-small').show();
    updateStatus([keyword.id], !keyword.enabled, (result) => {
        if (result.success) {
            keyword.enabled = !keyword.enabled;
            renderKeywordStatus(keyword, $(this));
        }
        else {
            console.error('problems updating status:', result);
        }
        $(this).find('.a-button').show();
        $(this).find('.loading-small').hide();
    });
});

$(document).on('click', '.ams-unlocked-kwbid input[name=save]', function() {
    let cell = $(this).parents('.ams-unlocked-kwbid');
    let keyword = JSON.parse(cell.attr('data-ams-unlocked-keyword'));
    let input = cell.find('input[name=keyword-bid]');
    cell.children().hide();
    cell.find('.loading-small').show();
    updateBid([keyword.id], input.val(), (result) => {
        if (result.success) {
            keyword.bid = result.bid;
            renderKeywordBid(keyword, cell);
        }
        else {
            console.error('problems updating status:', result);
        }
        cell.children().show();
        cell.find('.loading-small').hide();
    });
});

function renderKeywordBid(keyword, cell) {
    cell = cell || cloneTemplate('ams-unlocked-kwbid');
    cell.show();
    cell.attr('data-ams-unlocked-keyword', JSON.stringify(keyword));

    cell.find('input[name=keyword-bid]')
        .attr('value', keyword.bid);

    return cell[0].outerHTML;
}

function renderKeywordStatus(keyword, cell) {
    cell = cell || cloneTemplate('ams-unlocked-kwstatus');
    cell.show();
    cell.attr('data-ams-unlocked-keyword', JSON.stringify(keyword));

    let statusImg = cell.find('.ams-dropdown-status');
    let statusTxt = cell.find('.ams-unlocked-kwstatus-current');
    if (keyword.enabled) {
        statusImg.addClass('ams-status-active');
        statusImg.removeClass('ams-status-paused');
        statusTxt.text('Enabled');
    }
    else {
        statusImg.removeClass('ams-status-active');
        statusImg.addClass('ams-status-paused');
        statusTxt.text('Paused');
    }

    return cell[0].outerHTML;
}

$(document).on('click', '.ams-unlocked-kwstatus-bulk', function() {
    let container = $(this).parents('.ams-unlocked-kwupdate-bulk');
    let data = container[0].data;
    let enabled = data[0].enabled;
    $(this).find('.a-button').hide();
    $(this).find('.loading-small').show();
    updateStatus(data.map(kw => kw.id), !enabled, (result) => {
        if (result.success) {
            data.forEach(x => x.enabled = !enabled);
            renderKeywordTable(data, container[0].opts);
        }
        else {
            console.error('problems updating status:', result);
        }
    });
});

$(document).on('click', '.ams-unlocked-kwbid-bulk input[name=save]', function() {
    let container = $(this).parents('.ams-unlocked-kwupdate-bulk');
    let cell = $(this).parents('.ams-unlocked-kwbid-bulk');
    let input = cell.find('input[name=keyword-bid]');
    let data = container[0].data;
    cell.children().hide();
    cell.find('.loading-small').show();
    updateBid(data.map(kw => kw.id), input.val(), (result) => {
        if (result.success) {
            data.forEach(kw => kw.bid = result.bid);
            renderKeywordTable(data, container[0].opts);
        }
        else {
            console.error('problems updating status:', result);
        }
    });
});

function renderBulkUpdate(data, opts) {
    let bulk = cloneTemplate('ams-unlocked-kwupdate-bulk');
    bulk[0].data = data;
    bulk[0].opts = opts;

    renderKeywordStatus(data[0] || {}, bulk.find('.ams-unlocked-kwstatus-bulk'));
    renderKeywordBid(data[0] || {}, bulk.find('.ams-unlocked-kwbid-bulk'));

    bulk.show();

    return bulk;
}

function cloneTemplate(id) {
    let elem = $('#'+id).clone();
    elem.removeAttr('id');
    elem.show();
    elem.removeClass('a-hidden'); // Amazon adds this to our elements for some reason
    return elem;
}
