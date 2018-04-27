const bg = require('./common.js');
const moment = require('moment');
const _ = require('lodash');

function* setSession() {
    const time = Date.now();
    const asins = yield* fetchAsins(time);
    yield bg.parallelQueue(asins, function* (asin) {
        const sales = yield* fetchSalesData(time, asin);
        const ku = yield* fetchKuData(time, asin);
        
        console.log('asin', asin, 'sales', sales, 'ku', ku);
    });
}

function requestPermission() {
    return new Promise((resolve, reject) => {
        chrome.permissions.request({ origins: ['https://kdp.amazon.com/*'] }, granted => {
            if (granted)
                return resolve();
            return reject(new Error('user refused'));
        });
    });
}

function baseRequest(time) {
    const todayFmt = moment().format('YYYY-MM-DD');
    const past90DaysFmt = moment().subtract(90, 'days').format('YYYY-MM-DD');
    return {
        requesttype: 'render',
        customer: '',
        locale: 'en_US',
        namespace: 'kdp',
        pageid: 'KDP_UI_OP',
        vendorcode: '',
        time,
        _filter_marketplaceId: JSON.stringify({ "type": "dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_author: JSON.stringify({ "type": "dynamic-dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_book_type: JSON.stringify({ "type": "dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_reportDate: JSON.stringify({ "type": "date-range", "from": past90DaysFmt, "to": todayFmt}), // eslint-disable-line camelcase
    };
}

function kdpAjax(request) {
    return bg.ajax({
        url: 'https://kdp.amazon.com/en_US/reports-new/data',
        method: 'POST',
        data: request,
        dataType: 'json',
    });
}

function* fetchAsins(time) {
    const titleRequest = Object.assign(baseRequest(time), { 
        'post-ajax': JSON.stringify([{ action: "load", ids: ["sales-dashboard-chart-orders", "sales-dashboard-chart-ku", "sales-dashboard-table"], type: "onLoad" }]),
        target: JSON.stringify([{ id: "sales-dashboard-dd-asin", type: "dynamic-dropdown", metadata: "STRING"}]),
        'request-id': 'KDPGetTitles_OP'
    });

    const response = yield kdpAjax(titleRequest);
    const data = JSON.parse(response.data);
    return data['dynamic-dropdown'].map(x => x[0].split(','));
}

function* fetchSalesData(time, asin) {
    const reportRequest = Object.assign(baseRequest(time), {
        'post-ajax': JSON.stringify([{ "action": "show", "ids": ["sales-dashboard-export-button"], "type": "onLoad" }]),
        target: JSON.stringify([{ "id": "sales-dashboard-chart-orders", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChart_OP',
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": asin }), // eslint-disable-line camelcase
    });
    
    const response = yield kdpAjax(reportRequest);
    const data = JSON.parse(response.data);
    return _.zip(data.chart.xvalues, data.chart.line1);
}

function* fetchKuData(time, asin) {
    const reportRequest = Object.assign(baseRequest(time), {
        'post-ajax': [],
        target: JSON.stringify([{ "id": "sales-dashboard-chart-ku", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChartKU_OP',
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": asin }), // eslint-disable-line camelcase
    });

    const response = yield kdpAjax(reportRequest);
    const data = JSON.parse(response.data);
    return _.zip(data.chart.xvalues, data.chart.line1);
}

module.exports = {
    setSession,
    requestPermission,
    fetchSalesData,
    fetchKuData,
};
