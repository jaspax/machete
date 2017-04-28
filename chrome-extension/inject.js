const prefix = 'ams-unlocked';
const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;
const span = {
    second: 1000,
    minute: 1000 * 60,
    hour:   1000 * 60 * 60,
    day:    1000 * 60 * 60 * 24,
};

const charts = [
    { label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour'} },
    { label: "Clicks / day", config: {metric: 'clicks', rate: 'day'} },
    { label: "Sales / day", config: {metric: 'salesCount', rate: 'day'} },
];

const historyLink = $(`<a href="#" class="${showHistoryClass}">Show performance history</a>`);
historyLink.click(function(evt) {
    // Get the campaignId with a horrible bit of hackery. TODO: this is
    // tremendously fragile.
    let firstCell = $(this).parent().siblings()[0];
    let select = $(firstCell).find('select');
    let selectName = select[0].name;
    let campaignId = selectName.split('_').pop();
    campaignId = campaignId.substring(0, 22); // first 22 chars are the campaignId; timestamp is appended for some reason
    console.log("discovered campaign", campaignId);
    getDataHistory(getEntityId(), campaignId, (data) => {
        renderChart(data, charts[0]);
    });
});

window.setInterval(() => {
    let actionCells = $('td.actions-cell').not(`:has(.${showHistoryClass})`);
    actionCells.append(historyLink);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}"></div>`));
    }
}, 100);

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
    cookies: document.cookie,
});

function getEntityId() {
    let qstring = window.location.search.substring(1);
    let qs = qstring.split('&');
    for (let q of qs) {
        let parts = q.split('=');
        if (parts[0] == 'entityId') {
            return parts[1];
        }
    }
    return undefined;
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

function renderChart(data, opt) {
    var data = transformHistoryData(data, opt.config);

    var series = {
      x: data.timestamps,
      y: data[opt.config.metric],
      mode: 'lines+markers',
      name: opt.config.metric,
      line: {shape: 'spline'},
      connectgaps: true
    };

    var layout = {
      title: opt.label,
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
