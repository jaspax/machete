const cellClass = 'ams-unlocked-showhistory';

const historyLink = $(`<a href="#" class="${cellClass}">Show performance history</a>`);
historyLink.click(function(evt) {
    // Get the campaign ID with a horrible bit of hackery. TODO: this is
    // tremendously fragile.
    let firstCell = $(this).parent().siblings()[0];
    let select = $(firstCell).find('select');
    let selectName = select[0].name;
    let campaign = selectName.split('_').pop();
    campaign = campaign.substring(0, 22); // first 22 chars are the campaign ID; timestamp is appended for some reason
    console.log("discovered campaign", campaign);
    getDataHistory((data) => {
        console.log("campaign data", data[campaign]);
    });
});

window.setInterval(() => {
    let actionCells = $('td.actions-cell').not(`:has(.${cellClass})`);
    actionCells.append(historyLink);
}, 100);

let campaign_data = {}; // Populated on request

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

function getDataHistory(cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: getEntityId(),
    },
    (response) => {
        campaign_data = transformHistoryData(response)
        cb(campaign_data);
    });
}

function showDataChart(campaign) {
    const chartId = 'ams-unlocked-chart-'+campaign;
    $('#'+chartId).slideDown();

    var data = campaign_data[campaign];

    var impressions = {
      x: data.timestamps, 
      y: data.impressions,
      mode: 'lines',
      connectgaps: true
    };
    var clicks = {
      x: data.timestamps, 
      y: data.clicks,
      mode: 'lines',
      connectgaps: true
    }
    var sales = {
      x: data.timestamps, 
      y: data.salesCount,
      mode: 'lines',
      connectgaps: true
    }

    var data = [impressions, clicks, sales];

    var layout = {
      title: 'Performance over time',
      showlegend: false
    };

    Plotly.newPlot(chartId, data, layout);
}

function transformHistoryData(data) {
    // Get the first timestamp, as we'll need it later because we care mostly
    // about relative timestamps
    let firstTimestamp = Number.MAX_SAFE_INTEGER;
    for (let d of data) {
        if (parseInt(d.timestamp) < firstTimestamp)
            firstTimestamp = d.timestamp;
    }

    // We have a series of timestamped snapshots; we want a series of parallel
    // arrays keyed by campaign id
    let campaign = {};
    for (let d of data) {
        for (let item of d.aaData) {
            if (!campaign[item.campaignId]) {
                campaign[item.campaignId] = {
                    timestamps: [],
                    impressions: [],
                    clicks: [],
                    salesCount: [],
                    salesValue: [],
                };
            }
            let c = campaign[item.campaignId];
            c.timestamps.push(d.timestamp - firstTimestamp);
            c.impressions.push(item.impressions);
            c.clicks.push(item.clicks);
            c.salesCount.push(item.attributedPurchases);
            c.salesValue.push(item.attributedPurchasesCost);
        }
    }

    return campaign;
}
