const tabClass = `${prefix}-tab`;
const chartId = `${prefix}-kwchart`;

window.setInterval(() => {
    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
    }
}, 100);

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

        // We often don't want to display data for points with very low numbers
        // of impressions, so we set a "minimum meaningful impressions" value at
        // 10% of what would be the value if all keywords had the same number of
        // impressions.
        let totalImpressions = data.reduce((acc, val) => acc + val.impressions, 0);
        let minImpressions = totalImpressions / (data.length * 10);

        let salesQuartileCutoff = data.sort((a, b) => a.sales - b.sales)[Math.round(data.length / 4)];

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
            filterFn: (x) => x.clicks && x.impressions > minImpressions,
            metricFn: (x) => x.clicks/x.impressions, 
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(data, {
            tableSelector: '#ams-unlocked-spend',
            columnTitle: 'Spend',
            order: 'desc',
            filterFn: (x) => x.clicks && !x.sales,
            metricFn: (x) => x.spend,
            formatFn: (x) => `$${x}`,
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
            columnTitle: 'Impressions',
            order: 'desc',
            filterFn: (x) => x.clicks && x.impressions > minImpressions,
            metricFn: (x) => x.clicks/x.impressions, 
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
            filterFn: (x) => x.sales && x.sales >= salesQuartileCutoff.sales,
            metricFn: (x) => x.sales,
            formatFn: (x) => `$${x}`,
        });
    });
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
            `"${kw}"<br />Impressions: ${kws.impressions[i]}<br />Clicks: ${kws.clicks[i]}<br />Avg CPC: $${kws.avgCpc[i]}<br />Avg COS: ${kws.acos[i]}%`),
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
    data = data.map(x => [x.keyword, formatFn(opts.metricFn(x))]);

    $(opts.tableSelector).DataTable({
        data: data,
        order: [[1, opts.order || 'asc']],
        columns: [{ title: "Keyword" }, { title: opts.columnTitle }],
    });

    $(opts.tableSelector).width('100%'); // TODO: figure out why DataTables is setting this to 0
}
