const React = require('react');
const PropTypes = require('prop-types');
const CampaignHistoryView = require('./CampaignHistoryView.jsx');

function CampaignHistoryTab(props) {
    return (
        <div className="a-box-inner">
            <h1>Campaign History</h1>
            <CampaignHistoryView dataPromise={props.dataPromise} />
        </div>
    );
}

CampaignHistoryTab.propTypes = { dataPromise: PropTypes.object.isRequired, };

module.exports = CampaignHistoryTab;
