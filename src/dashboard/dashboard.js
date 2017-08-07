const $ = require('jquery');
const Plotly = require('plotly.js');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

const chartPng = chrome.runtime.getURL('images/chart-16px.png');
const chartId = `machete-chart`;
const chartLoginRequired = `machete-chart-login-required`;
const chartUpgradeRequired = `machete-chart-upgrade-required`;
const chartClass = `machete-chart-btn`;
const chartClassDisabled = `machete-chart-btn-disabled`;

const charts = [
    { column: 6, label: "Impressions / hour", config: {metric: 'impressions', rate: 'hour', chunk: 'hour', round: true} },
    { column: 7, label: "Clicks / day", config: {metric: 'clicks', rate: 'day', chunk: 'day', round: true} },
    { column: 9, label: "Spend / day", config: {metric: 'spend', rate: 'day', chunk: 'day', round: false} },
    { column: 10, label: "Sales / day", config: {metric: 'salesCount', rate: 'day', chunk: 'day', round: false} },
    { column: 11, label: "ACOS", config: {metric: 'acos', chunk: 'day', round: false} },
];

chrome.runtime.sendMessage({
    action: 'getAllowedCampaigns', 
    entityId: common.getEntityId(),
},
ga.mcatch(response => {
    if (response.error) {
        ga.merror(response.status, response.error);
    }
    const allowedCampaigns = response.data;
    window.setInterval(ga.mcatch(() => {
        let tableRows = $('#campaignTable tbody tr');
        addChartButtons(tableRows, allowedCampaigns);
    }), 100);
}));

const templateUrl = chrome.runtime.getURL('html/templates.html');
$.ajax(templateUrl, {
    method: 'GET',
    success: (data) => {
        let dashboard = $('#campaignDashboard');
        dashboard.append(data);
    },
});

function addChartButtons(rows, allowedCampaigns) {
    for (let row of rows) {
        for (let chart of charts) {
            let cells = $(row).children();
            let target = cells[chart.column];
            if (!target || $(target).find(`.${chartClass}`).length > 0)
                continue;

            let link = $(cells[1]).find('a')[0];
            if (!link)
                continue;

            let name = cells[1].innerText;
            let href = link.href;
            let campaignId = common.getCampaignId(href);

            let btnClasses = chartClass;
            let allowed = allowedCampaigns.includes(campaignId);
            let eventCategory = 'thumbnail-enabled';
            if (!allowed) {
                btnClasses += ` ${chartClassDisabled}`;
                eventCategory = 'thumbnail-disabled';
            }
            let btn = $(`<a href="#" class="${btnClasses}"><img src="${chartPng}" /></a>`);
            btn.click(ga.mcatch(function() {
                ga.mclick(eventCategory, chart.config.metric);

                let newId = chartId+campaignId+chart.config.metric;
                let popup = $('#'+newId);
                if (!popup.length) {
                    if (allowed) {
                        popup = $('#'+chartId).hide().clone();
                        popup.addClass(chartId);
                    }
                    else if (window.user.isAnon) {
                        popup = $('#'+chartLoginRequired).hide().clone();
                        popup.addClass(chartLoginRequired);
                    }
                    else {
                        popup = $('#'+chartUpgradeRequired).hide().clone();
                        popup.addClass(chartUpgradeRequired);
                    }
                    popup.attr('id', newId);
                    $(document.body).append(popup);
                }
                // hard-coded element width below b/c popup.width() doesn't
                // work as required. must reposition every time we display in
                // order to work correctly with scrolling.
                let pos = btn.offset();
                if (pos.left + 420 > $(document).width()) { 
                    popup.css({top: pos.top + btn.height() + 6, left: pos.left + btn.width() - 414});
                }
                else {
                    popup.css({top: pos.top + btn.height() + 6, left: pos.left});
                }
                const bodyTop = $('body').scrollTop();
                const bodyLeft = $('body').scrollLeft();

                popup.slideDown(200, function() {
                    $('body').scrollTop(bodyTop);
                    $('body').scrollLeft(bodyLeft);

                    // Clicking anywhere outside the popup dismisses the chart
                    $(document).on('click.machete.thumbnail-dismiss', ga.mcatch(function() {
                        if (!$.contains(popup[0], this)) {
                            ga.mga('event', eventCategory, 'dismiss', chart.config.metric);
                            popup.hide();
                            $(document).off('click.machete.thumbnail-dismiss');
                        }
                    }));
                });

                if (allowed) {
                    getDataHistory(common.getEntityId(), campaignId, (data) => {
                        renderChart(data, name, Object.assign({id: newId}, chart));
                    });
                }
            }));
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
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            return;
        }
        cb(response.data);
    }));
}

function renderChart(data, name, opt) {
    const daysMs = 10 * common.span.day;
    opt.config.startTimestamp = Date.now() - daysMs;
    data = common.parallelizeHistoryData(data, opt.config);

    const series = {
      x: data.timestamps,
      y: data[opt.config.metric],
      mode: 'lines+markers',
      name: opt.config.metric,
      connectgaps: true
    };

    let height = 300;
    if (data.timestamps.length < 3) {
        height = 270; // leaving room for the lodata link
    }

    const layout = {
      title: `${opt.label}<br />${name}`,
      width: 400,
      height,
      margin: { l: 40, r: 20, b: 25, t: 60, pad: 4 },
    };

    Plotly.newPlot(opt.id, [series], layout, {displayModeBar: false});

    let container = $('#'+opt.id);
    if (data.timestamps.length < 3) {
        let a = container.find(`a.machete-lodata`);
        a[0].href = chrome.runtime.getURL('html/low-data.html');
        a.show();
    }
}
