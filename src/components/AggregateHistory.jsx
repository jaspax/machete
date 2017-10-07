const React = require('react');
const PropTypes = require('prop-types');

const CampaignSelector = require('./CampaignSelector.jsx');
const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');

class AggregateHistory extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.loadData = this.loadData.bind(this);
        this.setState({ campaigns: [] });
    }

    render() {
        return <div>
            <CampaignSelector selectGroups={true} campaigns={this.state.campaigns} onChange={this.campaignSelectionChange} />
            <CampaignDateRangeTable 
                startDate={this.state.startDate} startMetrics={this.state.startMetrics}
                endDate={this.state.endDate} endMetrics={this.state.endMetrics}
                onRangeChange={this.rangeChange} />
            <CampaignHistoryChart loadData={this.loadData} />
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ campaigns: selection });
    }

    loadData(cb) {
        this.props.loadData(this.state.campaigns, cb);
    }
}

AggregateHistory.propTypes = {
    campaigns: PropTypes.array.isRequired,
    loadData: PropTypes.func.isRequired,
};

AggregateHistory.defaultProps = {};

module.exports = AggregateHistory;
