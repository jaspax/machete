const React = require('react');
const PropTypes = require('prop-types');
const KeywordAnalysis = require('./KeywordAnalysis.jsx');

function KeywordAnalyticsTab(props) {
    return <div className="a-box-inner">
        <h1>Keyword Analytics</h1>
        <KeywordAnalysis dataPromise={props.dataPromise} 
            updateStatus={props.updateStatus} updateBid={props.updateBid} />
    </div>;
}

KeywordAnalyticsTab.propTypes = {
    dataPromise: PropTypes.object.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
};

module.exports = KeywordAnalyticsTab;
