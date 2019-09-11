const bg = require('./common.js');
const moment = require('moment');
const ga = require('../common/ga.js');

const kdpPermissions = { origins: ['https://kdp.amazon.com/*'] };

function requestPermission() {
    return ga.mpromise(resolve => chrome.permissions.request(kdpPermissions, resolve));
}

function hasPermission() {
    return ga.mpromise(resolve => chrome.permissions.contains(kdpPermissions, resolve));
}

function baseRequest(time) {
    const todayFmt = moment(time).format('YYYY-MM-DD');
    const past90DaysFmt = moment(time).subtract(90, 'days').format('YYYY-MM-DD');
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

const kdpUrl = 'https://kdp.amazon.com/en_US/reports-new/data';
async function kdpAjax(request) {
    const response = await bg.ajax(kdpUrl, {
        method: 'POST',
        formData: request,
        responseType: 'json',
    });
    if (response.exception) {
        ga.warn(`KDP error for request body ${request}`);
        const ex = new Error("KDP reported an unrecoverable error");
        ex.url = kdpUrl;
        ex.formData = JSON.stringify(request);
        throw ex;
    }
    return response.data;
}

async function requestAsins({ time }) {
    const titleRequest = Object.assign(baseRequest(time), { 
        'post-ajax': JSON.stringify([{ action: "load", ids: ["sales-dashboard-chart-orders", "sales-dashboard-chart-ku", "sales-dashboard-table"], type: "onLoad" }]),
        target: JSON.stringify([{ id: "sales-dashboard-dd-asin", type: "dynamic-dropdown", metadata: "STRING"}]),
        'request-id': 'KDPGetTitles_OP'
    });

    const strData = await kdpAjax(titleRequest);
    const data = JSON.parse(strData);
    return data['dynamic-dropdown'].map(x => x[0].split(','));
}

function requestSalesData({ time, asin }) {
    const reportRequest = Object.assign(baseRequest(time), {
        'post-ajax': JSON.stringify([{ "action": "show", "ids": ["sales-dashboard-export-button"], "type": "onLoad" }]),
        target: JSON.stringify([{ "id": "sales-dashboard-chart-orders", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChart_OP',
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": asin }), // eslint-disable-line camelcase
    });
    
    return kdpAjax(reportRequest);
}

function requestKuData({ time, asin }) {
    const reportRequest = Object.assign(baseRequest(time), {
        'post-ajax': [],
        target: JSON.stringify([{ "id": "sales-dashboard-chart-ku", "type": "chart", "metadata": "DATE" }]),
        'request-id': 'KDPGetLineChartKU_OP',
        _filter_asin: JSON.stringify({ "type": "dynamic-dropdown", "value": asin }), // eslint-disable-line camelcase
    });

    return kdpAjax(reportRequest);
}

module.exports = {
    name: 'kdp',
    requestPermission,
    hasPermission,
    requestAsins,
    requestSalesData,
    requestKuData,
};
