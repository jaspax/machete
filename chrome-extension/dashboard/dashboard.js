'use strict';

const showHistoryClass = `${prefix}-showhistory`;
const chartId = `${prefix}-chart`;
const chartClass = `${prefix}-chart-btn`;

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour', chunk: 'hour', round: true} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true} },
    { column: 9, label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: false} },
];

window.setInterval(() => {
    let tableRows = $('#campaignTable tbody tr');
    addChartButtons(tableRows);

    let dashboard = $('#campaignDashboard');
    if (dashboard.find(`#${chartId}`).length == 0) {
        dashboard.append($(`<div id="${chartId}" style="display:none"></div>`));
    }
}, 100);

// This dismisses the chart flyout clicking anywhere outside the chart
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
                    let newId = chartId+campaignId+chart.config.metric;
                    let popup = btn.parent().find('#'+newId);
                    if (!popup.length) {
                        popup = $('#'+chartId).clone();
                        popup.attr('id', newId);
                        popup.addClass(chartId);
                        let pos = btn.position();
                        popup.css({top: pos.top + btn.height() + 6, left: pos.left});
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

    var layout = {
      title: `${opt.label}<br />${name}`,
      width: 400,
      height: 300,
      autosize: true,
    };

    Plotly.newPlot(opt.id, [series], layout);
};
