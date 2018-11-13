const React = require('react');
const PropTypes = require('prop-types');
const KeywordAnalysis = require('./KeywordAnalysis.jsx');

function KeywordAnalyticsTab(props) {
    return <div className="a-box-inner">
        <h1>Keyword Analytics</h1>
        <KeywordAnalysis 
            dataPromise={props.dataPromise} 
            campaignPromise={props.campaignPromise}
            onKeywordEnableChange={props.onKeywordEnableChange} 
            onKeywordBidChange={props.onKeywordBidChange} 
            onKeywordCopy={props.onKeywordCopy}
        />
    </div>;
}

KeywordAnalyticsTab.propTypes = {
    dataPromise: PropTypes.object.isRequired,
    campaignPromise: PropTypes.object.isRequired,
    onKeywordEnableChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
    onKeywordCopy: PropTypes.func.isRequired,
};

module.exports = KeywordAnalyticsTab;
