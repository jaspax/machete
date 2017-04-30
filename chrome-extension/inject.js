'use strict';

const prefix = 'ams-unlocked';
const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;
const chartClass = `${prefix}-chart-btn`;
const tabClass = `${prefix}-tab`;
const span = {
    second: 1000,
    minute: 1000 * 60,
    hour:   1000 * 60 * 60,
    day:    1000 * 60 * 60 * 24,
};

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour'} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day'} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day'} },
];

const getEntityId = () => getQueryArgs()['entityId'];
const getCampaignId = () => getQueryArgs()['campaignId'];

const unlockSvg = chrome.runtime.getURL('images/unlock.svg');

window.setInterval(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}"></div>`));
    }

    let campaignTabs = $('#campaign_detail_tab_set');
    if (campaignTabs.length && campaignTabs.find(`.${tabClass}`).length == 0) {
        addCampaignTabs(campaignTabs);
    }
}, 100);

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
    cookies: document.cookie,
});

function getQueryArgs() {
    let qstring = window.location.search.substring(1);
    let qs = qstring.split('&');
    let args = {};
    for (let q of qs) {
        let parts = q.split('=');
        args[parts[0]] = parts[1];
    }
    return args;
}

function addChartButtons(rows) {
    for (let row of rows) {
        for (let chart of charts) {
            let cells = $(row).children();
            let target = cells[chart.column];
            if (target && $(target).find(`.${chartClass}`).length == 0) {
                let select = $(cells[0]).find('select')[0];
                let name = cells[1].innerText;
                if (!select)
                    continue;
                let selectName = select.name;
                let campaignId = selectName.split('_').pop();
                campaignId = campaignId.substring(0, 22); // first 22 chars are the campaignId; timestamp is appended for some reason
                let btn = $(`<a href="#" class="${chartClass}">Chart</a>`);
                btn.click(function(evt) {
                    console.log("charting campaign", campaignId, chart.label);
                    getDataHistory(getEntityId(), campaignId, (data) => {
                        renderChart(data, name, chart);
                        $('body').scrollTop($('#'+chartId).offset().top);
                    });
                });
                $(target).append(btn);
            }
        }
    }
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
        window.setTimeout(() => {
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
            console.log(chartData);
            Plotly.newPlot(chartId, [chartData], layout, {showLink: false});
        }, 100);
    });
    $(tabs.children()[0]).after(li);

    // Fetch the url we want in order to actually embed it in the page
    $.ajax({
        url: chrome.runtime.getURL('keywordAnalytics.html'),
        success: (data, textStatus, xhr) => {
            console.log(data);
            tabs.parent().append(data);
        },
    });

    let adGroupId = $('input[name=adGroupId]')[0].value;
    let kws;

    getKeywordData(getEntityId(), adGroupId, (data) => {
        kws = transformKeywordData(data);
    });
}

function getDataHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    (response) => {
        console.log('data response', response);
        cb(response.data);
    });
}

function getKeywordData(entityId, adGroupId, cb) {
    chrome.runtime.sendMessage({
        action: 'requestKeywordData',
        entityId: entityId,
        adGroupId: adGroupId,
    },
    (response) => {
        console.log('keyword data response', response);
        cb(response.data);
    });
}; 

function renderChart(data, name, opt) {
    var data = transformHistoryData(data, opt.config);

    var series = {
      x: data.timestamps,
      y: data[opt.config.metric],
      mode: 'lines+markers',
      name: opt.config.metric,
      connectgaps: true
    };

    var layout = {
      title: `${opt.label} - ${name}`,
      height: 600,
      width: $('#campaignDashboard').width(),
      autosize: true,
    };

    Plotly.newPlot(chartId, [series], layout);

    let $chart = $('#'+chartId);
    $chart.slideDown();
};

function transformHistoryData(data, opt) {
    // We have a series of timestamped snapshots; we want a series of parallel
    // arrays keyed by campaignId
    let metric = opt.metric;
    let c = {
        timestamps: [],
        [metric]: []
    };
    let lastItem;
    for (let item of data) {
        // XXX: quick hack -- do this in backend?
        if (lastItem && lastItem[metric] >= item[metric]) {
                continue;
        }

        c.timestamps.push(new Date(item.timestamp).toISOString());
        if (opt.rate) {
            if (lastItem) {
                let timeDiff = item.timestamp - lastItem.timestamp;
                let denom = timeDiff/span[opt.rate];
                c[metric].push((item[metric] - lastItem[metric])/denom);
            }
        }
        else {
            c[metric].push(item[metric]);
        }

        lastItem = item;
    }

    return c;
}

// TODO: move this stuff up to the server
function transformKeywordData(data, opt) {
    let kws = {
        kw: [],
        impressions: [],
        spend: [],
        clicks: [],
        acos: [],
        avgCpc: [],
    };
    for (let k of data.aaData) {
        if (!k.clicks || !parseInt(k.clicks))
            continue;
        kws.kw.push(k.keyword);
        kws.impressions.push(numberize(k.impressions));
        kws.spend.push(numberize(k.spend));
        kws.clicks.push(numberize(k.clicks));
        kws.acos.push(numberize(k.acos));
        kws.avgCpc.push(numberize(k.avgCpc));
    }

    return kws;
}

function numberize(str) {
    if (!str)
        return str;
    str = str.replace(',', '');
    str = str.replace(' ', '');
    return parseFloat(str);
}
