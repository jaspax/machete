const React = require('react');
const PropTypes = require('prop-types');

const CampaignSelector = require('./CampaignSelector.jsx');
const CampaignHistoryView = require('./CampaignHistoryView.jsx');

class AggregateHistory extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.state = {};
    }

    render() {
        let display = null;
        if (this.state.dataPromise) {
             display = <CampaignHistoryView dataPromise={this.state.dataPromise} />;
        }

        return <div className="a-box-inner">
            <section className="machete-campaign-selector">
                <h1>Aggregate Campaign History</h1>
                <b>Select campaigns:</b>
                <CampaignSelector selectGroups={true} campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
            </section>
            <section className="machete-report">
                <h1>History</h1>
                {display}
            </section>
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ dataPromise: this.props.loadDataPromise(selection) });
    }
}

AggregateHistory.propTypes = {
    loadDataPromise: PropTypes.func.isRequired,
    campaignPromise: PropTypes.object.isRequired,
};

module.exports = AggregateHistory;
