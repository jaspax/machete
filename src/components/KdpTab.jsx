const React = require('react');
const Async = require('react-promise').default;
const common = require('../common/common.js');

function KdpTab() {
    return <div className="a-box-inner">
        <h1>KDP Integration</h1>
        <Async promise={hasPermissions()} pending={pending()} then={showDescription} />
    </div>;
}

function pending() {
    return <div className="loading-large"></div>;
}

function request() {
    common.bgMessage({ action: 'kdp.requestPermission' });
}

function hasPermissions() {
    return common.bgMessage({ action: 'kdp.hasPermission' });
}

function showDescription(enabled) {
    return enabled ? enabledDescription() : notEnabledDescription();
}

function enabledDescription() {
    return <div>
        <p>KDP Integration is enabled! You should have sweet, sweet KDP
            data.</p>
    </div>;
}

function notEnabledDescription() {
    return <div>
        <p>Enabling KDP integration will allow Machete to gather data about your
            self-publishing sales via Kindle Direct Publishing and AMS
            Advantage. Machete can use this data to estimate your Kindle
            Unlimited income and provide you with some basic reports about
            historical book sales.</p>
        <button className="machete-highlight-button" onClick={request}>Enable KDP Integration</button>
    </div>;
}

KdpTab.propTypes = {};

module.exports = KdpTab;
