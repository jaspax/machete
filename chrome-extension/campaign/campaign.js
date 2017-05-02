const tabClass = `${prefix}-tab`;

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
        url: chrome.runtime.getURL('keywordAnalytics.html'),
        success: (data, textStatus, xhr) => tabs.parent().append(data),
    });

    let adGroupId = $('input[name=adGroupId]')[0].value;

    getKeywordData(getEntityId(), adGroupId, (data) => {
        renderKeywordChart(transformKeywordData(data), {});

        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-click-ratio',
            filterFn: (x) => x.clicks,
            metricFn: (x) => x.clicks/x.impressions, 
            formatFn: (x) => `${Math.round(x*10000)}`,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-acos',
            filterFn: (x) => x.clicks && x.acos > 100,
            metricFn: (x) => -x.acos,
            formatFn: (x) => x ? `${-x}%` : "(no sales)",
            limit: 10,
        });
        renderKeywordTable(data, {
            tableSelector: '#ams-unlocked-spend',
            filterFn: (x) => x.clicks && !x.sales,
            metricFn: (x) => -x.spend,
            formatFn: (x) => `$${-x}`,
            limit: 10,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-impressions',
            metricFn: (x) => x.impressions,
            formatFn: (x) => x || 0,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-high-click-ratio',
            filterFn: (x) => x.clicks,
            metricFn: (x) => -(x.clicks/x.impressions), 
            formatFn: (x) => `${Math.round(-x*10000)}`,
        });
        renderKeywordTable(data, { 
            tableSelector: '#ams-unlocked-low-acos',
            filterFn: (x) => x.sales && x.acos < 100,
            metricFn: (x) => x.acos,
            formatFn: (x) => `${x}%`,
            limit: 10,
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
            console.log('requestKeywordData', response)
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
    if (opts.filterFn)
        data = data.filter(opts.filterFn);
    let sorted = data.sort((a, b) => opts.metricFn(a) - opts.metricFn(b));
    let limit = opts.limit || 20;
    let formatFn = opts.formatFn ? opts.formatFn : (x) => x;
    let table = $(opts.tableSelector);
    let row = table.find('.ams-unlocked-repeat');

    for (let i = 0; i < sorted.length && i < limit; i++) {
        let kw = sorted[i];
        let newRow = row.clone();
        newRow.find('.ams-unlocked-keyword').text(kw.keyword);
        newRow.find('.ams-unlocked-p1').text(formatFn(opts.metricFn(kw)));
        newRow.show();
        table.append(newRow);
    }
    row.hide();
}
