const bg = require('./common.js');
const moment = require('moment');

/*
const co = require('co');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const ga = require('../common/ga.js');
*/

function* setSession() {
    const sales = yield fetchSalesData();
    const ku = yield fetchKuData();

    console.log('sales', sales, 'KU', ku);
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

function baseRequest() {
    const todayFmt = moment().format('YYYY-MM-DD');
    const past90DaysFmt = moment().subtract(90, 'days').format('YYYY-MM-DD');
    return {
        requesttype: 'render',
        customer: '',
        locale: 'en_US',
        namespace: 'kdp',
        pageid: 'KDP_UI_OP',
        vendorcode: '',
        time: Date.now(),
        _filter_marketplaceId: JSON.stringify({ "type": "dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_author: JSON.stringify({ "type": "dynamic-dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
        _filter_reportDate: JSON.stringify({ "type": "date-range", "from": past90DaysFmt, "to": todayFmt}), // eslint-disable-line camelcase
        _filter_book_type: JSON.stringify({ "type": "dropdown", "value": ["_ALL"] }), // eslint-disable-line camelcase
    };
}

function fetchSalesData() {
    const reportRequest = Object.assign({
        'post-ajax': JSON.stringify([{ "action": "show", "ids": ["sales-dashboard-export-button"], "type": "onLoad" }]),
        target: JSON.stringify([{ "id": "sales-dashboard-chart-orders", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChart_OP',
    }, baseRequest());
    
    return bg.ajax({
        url: 'https://kdp.amazon.com/en_US/reports-new/data',
        method: 'POST',
        data: reportRequest,
        dataType: 'json',
    });
}

function fetchKuData() {
    const reportRequest = Object.assign({
        'post-ajax': [],
        target: JSON.stringify([{ "id": "sales-dashboard-chart-ku", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChartKU_OP',
    }, baseRequest());

    return bg.ajax({
        url: 'https://kdp.amazon.com/en_US/reports-new/data',
        method: 'POST',
        data: reportRequest,
        dataType: 'json',
    });
}

module.exports = {
    setSession,
    requestPermission,
    fetchSalesData,
    fetchKuData,
};
