const React = require('react');
const PropTypes = require('prop-types');
const DataNotAvailable = require('./DataNotAvailable.jsx');
const KeywordAnalysis = require('./KeywordAnalysis.jsx');

function KeywordAnalyticsTab(props) {
    let body = null;
    if (props.allowed) {
        body = <KeywordAnalysis dataPromise={props.dataPromise} 
            updateStatus={props.updateStatus} updateBid={props.updateBid} />;
    }
    else {
        body = <DataNotAvailable allowed={props.allowed} anonymous={props.anonymous} />;
    }
    return <div id="machete-keyword-analysis" className="a-box-inner">{body}</div>;
}

KeywordAnalyticsTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    dataPromise: PropTypes.object.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
};

module.exports = KeywordAnalyticsTab;
