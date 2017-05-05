'use strict';

const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;
const chartClass = `${prefix}-chart-btn`;

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour', chunk: 'hour', round: true} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true} },
    { column: 9, label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: false} },
    { column: 11, label: "ACOS", config: {metric: 'acos', chunk: 'day', round: false} },
];

window.setInterval(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}" style="display:none"></div>`));
    }
}, 100);

function addChartButtons(rows) {
    for (let row of rows) {
        for (let chart of charts) {
            let cells = $(row).children();
            let target = cells[chart.column];
            if (!target || $(target).find(`.${chartClass}`).length > 0)
                continue;

            let select = $(cells[0]).find('select')[0];
            let name = cells[1].innerText;
            if (!select)
                continue;

            let selectName = select.name;
            let campaignId = selectName.split('_').pop();
            campaignId = campaignId.substring(0, 22); // first 22 chars are the campaignId; timestamp is appended for some reason
            let btn = $(`<a href="#" class="${chartClass}"><img src="${chartPng}" /></a>`);
            btn.click(function(evt) {
                let newId = chartId+campaignId+chart.config.metric;
                let popup = btn.parent().find('#'+newId);
                if (!popup.length) {
                    popup = $('#'+chartId).clone();
                    popup.attr('id', newId);
                    popup.addClass(chartId);
                    
                    // hard-coded element width below b/c popup.width() doesn't
                    // work as required
                    let pos = btn.position();
                    if (pos.left + 420 > $(document).width()) { 
                        popup.css({top: pos.top + btn.height() + 6, left: pos.left + btn.width() - 414});
                    }
                    else {
                        popup.css({top: pos.top + btn.height() + 6, left: pos.left});
                    }
                    btn.after(popup);
                }
                popup.show();

                getDataHistory(getEntityId(), campaignId, (data) => {
                    renderChart(data, name, Object.assign({id: newId}, chart));

                    // Clicking anywhere outside the chart dismisses the chart
                    $(document).on('click', function() {
                        if (!$.contains(popup[0], this)) {
                            popup.hide();
                            $(document).off('click');
                        }
                    });
                });
            });
            $(target).append(btn);
        }
    }
}

function getDataHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    (response) => cb(response.data));
}

function renderChart(data, name, opt) {
    var data = parallelizeHistoryData(data, opt.config);

    var series = {
      x: data.timestamps,
      y: data[opt.config.metric],
      mode: 'lines+markers',
      name: opt.config.metric,
      connectgaps: true
    };

    let height = 300;
    if (data.timestamps.length < 3) {
        height = 270; // leaving room for link below
    }

    var layout = {
      title: `${opt.label}<br />${name}`,
      width: 400,
      height,
      margin: { l: 40, r: 20, b: 25, t: 60, pad: 4 },
    };

    Plotly.newPlot(opt.id, [series], layout, {displayModeBar: false});

    let container = $('#'+opt.id);
    if (data.timestamps.length < 3 && container.find('a.ams-unlocked-lodata').length == 0) {
        let lowDataHref = chrome.runtime.getURL('common/low-data.html');
        container.append(`<p><a class="ams-unlocked-lodata" target="_blank" href="${lowDataHref}">Why don't I see any data?</a></p>`);
    }
};
