const prefix = 'ams-unlocked';
const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;

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
        showDataChart(data);
    });
});

window.setInterval(() => {
    let actionCells = $('td.actions-cell').not(`:has(.${showHistoryClass})`);
    actionCells.append(historyLink);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}" style="display:none"></div>`));
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
        let data = transformHistoryData(response.data, {differential: true})
        cb(data);
    });
}

function showDataChart(data) {
    let $chart = $('#'+chartId);
    $chart.slideDown();

    var impressions = {
      x: data.timestamps, 
      y: data.impressions,
      mode: 'lines+markers',
      name: 'Impressions/hr',
      line: {shape: 'spline'},
      connectgaps: true
    };
    var clicks = {
      x: data.timestamps, 
      y: data.clicks,
      mode: 'lines',
      name: 'Clicks/hr',
      connectgaps: true
    }
    var sales = {
      x: data.timestamps, 
      y: data.salesCount,
      mode: 'lines',
      name: 'Sales/hr',
      connectgaps: true
    }

    //var series = [impressions, clicks, sales];
    //var series = [impressions, clicks];
    var series = [impressions];

    var layout = {
      title: "Impressions per hour",
      height: 600,
      width: $('#campaignDashboard').width(),
      autosize: true,
    };

    Plotly.newPlot(chartId, series, layout);
}

function transformHistoryData(data, opt) {
    // We have a series of timestamped snapshots; we want a series of parallel
    // arrays keyed by campaignId
    let c = {
        timestamps: [],
        impressions: [],
        clicks: [],
        salesCount: [],
        salesValue: [],
    };
    let lastItem;
    for (let item of data) {
        // XXX: quick hack -- should do this in backend
        if (lastItem) {
            if (lastItem.impressions == item.impressions || lastItem.impressions > item.impressions)
                continue;
        }

        c.timestamps.push(new Date(item.timestamp).toISOString());
        if (opt.differential) {
            if (lastItem) {
                let timeDiff = item.timestamp - lastItem.timestamp;
                let hours = timeDiff/(1000 * 60 * 60);
                c.impressions.push((item.impressions - lastItem.impressions)/hours);
                c.clicks.push((item.clicks - lastItem.clicks)/hours);
                c.salesCount.push((item.salesCount - lastItem.salesCount)/hours);
                c.salesValue.push((item.salesValue - lastItem.salesValue)/hours);
            }
        }
        else {
            c.impressions.push(item.impressions);
            c.clicks.push(item.clicks);
            c.salesCount.push(item.salesCount);
            c.salesValue.push(item.salesValue);
        }

        lastItem = item;
    }

    return c;
}
