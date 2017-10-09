const React = require('react');
const PropTypes = require('prop-types');

const CampaignHistoryView = require('./CampaignHistoryView.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');
const DownloadButton = require('./DownloadButton.jsx');

function CampaignHistoryTab(props) {
    if (!props.allowed) {
        return <DataNotAvailable allowed={false} anonymous={props.anonymous} />;
    }

    return (
        <div className="a-box-inner">
            <h1>Campaign History</h1>

            <div id="machete-campaign-history-download-container">
                <DownloadButton href={props.downloadHref} title="Click to download campaign history" />
            </div>

            <CampaignHistoryView dataPromise={props.dataPromise} />
        </div>
    );
}

CampaignHistoryTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    downloadHref: PropTypes.string.isRequired,
    dataPromise: PropTypes.object.isRequired,
};

module.exports = CampaignHistoryTab;
