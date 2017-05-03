const tabClass = `${prefix}-tab`;
const chartId = `${prefix}-kwchart`;

window.setInterval(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
    }
}, 100);

function updateKeyword(keywordIdList, operation, dataValues, cb) {
    let entityId = getEntityId();
    let keywordIds = keywordIdList.join(',');
    let postData = Object.assign({operation, entityId, keywordIds}, dataValues);
    return $.ajax({
        url: 'https://ams.amazon.com/api/sponsored-products/updateKeywords/',
        method: 'POST',
        data: postData,
        dataType: 'json',
        success: (data, textStatus, xhr) => cb(Object.assign(data, dataValues)),
        error: (xhr, error, status) => cb({error}),
    });
}

function updateStatus(keywordIdList, enable, cb) {
    let operation = enable ? "ENABLE" : "PAUSE";
    return updateKeyword(keywordIdList, operation, {}, cb);
}

function updateBid(keywordIdList, bid, cb) {
    return updateKeyword(keywordIdList, 'UPDATE', {bid}, cb);
}

function addCampaignTabs(tabs) {
    // Add in the analytics tab
    let a = $('<a href="#">Keyword Analytics</a>');
    let li = $(`<li class="a-tab-heading ${tabClass}"></li>`);
    li.append(a);
    a.click(function(evt) {
        // Hide all of the body content except the one we want
        li.addClass('a-active');
        li.siblings().removeClass('a-active');
        tabs.parent().children('div').addClass('a-hidden');
        tabs.parent().find('#ams-unlocked-keyword-analysis').removeClass('a-hidden');
        $(`#${chartId}`).show();
    });
    $(tabs.children()[0]).after(li);

    // Fetch the url we want in order to actually embed it in the page
    $.ajax({
        url: chrome.runtime.getURL('campaign/keywordAnalytics.html'),
        success: (data, textStatus, xhr) => tabs.parent().append(data),
    });

    let adGroupId = $('input[name=adGroupId]')[0].value;

    getKeywordData(getEntityId(), adGroupId, (data) => {
        renderKeywordChart(transformKeywordData(data), {});
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

        let hasEnoughImpressions = x => x.clicks && x.impressions > minImpressions;
        let clickRatio = x => x.clicks/x.impressions;

        let salesTopQuartile = data.sort((a, b) => b.sales - a.sales)[Math.round(data.length / 4)];
        let clickRatioSort = data.filter(hasEnoughImpressions).sort((a, b) => clickRatio(a) - clickRatio(b));
        let clickRatioBottomQuartile = clickRatioSort[Math.round(clickRatioSort.length * 0.25)];
        let clickRatioTopQuartile = clickRatioSort[Math.round(clickRatioSort.length * 0.75)];

        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-acos',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: (x) => x.clicks && x.acos > 100,
            metricFn: (x) => x.acos,
            formatFn: (x) => x ? `${x}%` : "(no sales)",
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-click-ratio',
            columnTitle: 'Clicks per 10K impressions',
            order: 'asc',
            filterFn: (x) => hasEnoughImpressions(x) && clickRatio(x) <= clickRatio(clickRatioBottomQuartile),
            metricFn: clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(data, {
            tableSelector: '#ams-unlocked-spend',
            columnTitle: 'Spend',
            order: 'desc',
            filterFn: (x) => x.clicks && !x.sales,
            metricFn: (x) => x.spend,
            formatFn: moneyFmt,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-impressions',
            columnTitle: 'Impressions',
            order: 'asc',
            filterFn: (x) => x.impressions < minImpressions,
            metricFn: (x) => x.impressions,
            formatFn: (x) => x || 0,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-high-click-ratio',
            columnTitle: 'Clicks per 10K impressions',
            order: 'desc',
            filterFn: (x) => hasEnoughImpressions(x) && clickRatio(x) >= clickRatio(clickRatioTopQuartile),
            metricFn: clickRatio,
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-low-acos',
            columnTitle: 'ACOS',
            order: 'asc',
            filterFn: (x) => x.sales && x.acos < 100 && x.acos > 0,
            metricFn: (x) => x.acos,
            formatFn: (x) => `${x}%`,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-high-sales',
            columnTitle: 'Sales',
            order: 'desc',
            filterFn: (x) => x.sales && x.sales >= salesTopQuartile.sales,
            metricFn: (x) => x.sales,
            formatFn: moneyFmt,
        });
    });
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
            if (!response.data.length) {
                // Try our servers again
                chrome.runtime.sendMessage({
                    action: 'getKeywordData', // from our server
                    entityId: entityId,
                    adGroupId: adGroupId,
                },
                (response) => cb(response.data));
            }
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
        hovermode: 'closest'
    };
    Plotly.plot(chartId, [chartData], layout, {showLink: false});
}

function renderKeywordTable(data, opts) {
    data = data.filter(opts.filterFn ? opts.filterFn : x => true);

    let formatFn = opts.formatFn ? opts.formatFn : x => x;
    data = data.map(x => [
        x.keyword, 
        formatFn(opts.metricFn(x)), 
        renderKeywordStatus(x),
        renderKeywordBid(x),
    ]);

    $(opts.tableSelector).DataTable({
        data: data,
        order: [[1, opts.order || 'asc']],
        columns: [
            { title: "Keyword" }, 
            { title: opts.columnTitle }, 
            { title: "Status" },
            { title: "Bid" },
        ],
    });

    $(opts.tableSelector).width('100%'); // TODO: figure out why DataTables is setting this to 0
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
    cell = cell || $('#ams-unlocked-kwbid').clone();
    cell.removeAttr('id');
    cell.show();
    cell.attr('data-ams-unlocked-keyword', JSON.stringify(keyword));

    cell.find('input[name=keyword-bid]')
        .attr('value', keyword.bid);

    return cell[0].outerHTML;
}

function renderKeywordStatus(keyword, cell) {
    cell = cell || $('#ams-unlocked-kwstatus').clone();
    cell.removeAttr('id');
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
