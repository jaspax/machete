const React = require('react');
const common = require('../common/common.js');

function request() {
    common.bgMessage({ action: 'kdp.requestPermission' });
}

function KdpTab() {
    return <a onClick={request}>Click here to enable KDP integration</a>;
}

KdpTab.propTypes = {};

module.exports = KdpTab;
