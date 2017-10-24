const React = require('react');
const PropTypes = require('prop-types');

const CampaignHistoryView = require('./CampaignHistoryView.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');

function CampaignHistoryTab(props) {
    if (!props.allowed) {
        return <DataNotAvailable allowed={props.allowed} anonymous={props.anonymous} />;
    }

    return (
        <div className="a-box-inner">
            <h1>Campaign History</h1>
            <CampaignHistoryView dataPromise={props.dataPromise} />
        </div>
    );
}

CampaignHistoryTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    dataPromise: PropTypes.object.isRequired,
};

module.exports = CampaignHistoryTab;
