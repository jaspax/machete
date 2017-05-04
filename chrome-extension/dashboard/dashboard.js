'use strict';

const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;
const chartClass = `${prefix}-chart-btn`;

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour'} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day'} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day'} },
];

window.setInterval(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}"></div>`));
    }
}, 100);

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
                let btn = $(`<a href="#" class="${chartClass}"><img src="${chartPng}" /></a>`);
                btn.click(function(evt) {
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

function getDataHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    (response) => {
        cb(response.data);
    });
}

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

        if (opt.rate) {
            if (lastItem) {
                c.timestamps.push(new Date(item.timestamp).toISOString());
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
