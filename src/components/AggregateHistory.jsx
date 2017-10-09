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

        return <div>
            <CampaignSelector selectGroups={true} campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
            {display}
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

AggregateHistory.defaultProps = {};

module.exports = AggregateHistory;
