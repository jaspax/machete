const prefix = 'ams-unlocked';
const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;

const historyLink = $(`<a href="#" class="${showHistoryClass}">Show performance history</a>`);
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
        showDataChart(campaign);
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
        campaign_data = transformHistoryData(response, {differential: true})
        cb(campaign_data);
    });
}

function showDataChart(campaign) {
    let $chart = $('#'+chartId);
    $chart.slideDown();

    var data = campaign_data[campaign];

    var impressions = {
      x: data.timestamps, 
      y: data.impressions,
      mode: 'lines+markers',
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

    //var series = [impressions, clicks, sales];
    //var series = [impressions, clicks];
    var series = [impressions];

    var layout = {
      title: data.name,
      showlegend: false,
      height: 600,
      width: $('#campaignDashboard').width(),
      autosize: true,
    };

    Plotly.newPlot(chartId, series, layout);
}

function transformHistoryData(data, opt) {
    // We have a series of timestamped snapshots; we want a series of parallel
    // arrays keyed by campaign id
    let campaign = {};
    let lastItems = {};
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
            c.name = item.name;

            let lastItem = lastItems[item.campaignId];
            lastItems[item.campaignId] = item;

            // XXX: quick hack -- should do this in backend
            if (lastItem) {
                if (lastItem.impressions == item.impressions || lastItem.impressions > item.impressions)
                    continue;
            }

            c.timestamps.push(new Date(d.timestamp).toISOString());
            if (opt.differential) {
                if (lastItem) {
                    c.impressions.push(item.impressions - lastItem.impressions);
                    c.clicks.push(item.clicks - lastItem.clicks);
                    c.salesCount.push(item.attributedPurchases - lastItem.attributedPurchases);
                    c.salesValue.push(item.attributedPurchasesCost - lastItem.attributedPurchasesCost);
                }
            }
            else {
                c.impressions.push(item.impressions);
                c.clicks.push(item.clicks);
                c.salesCount.push(item.attributedPurchases);
                c.salesValue.push(item.attributedPurchasesCost);
            }

            lastItem = item;
        }
    }

    return campaign;
}
