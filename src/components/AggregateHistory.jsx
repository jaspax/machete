const React = require('react');
const PropTypes = require('prop-types');

const CampaignSelector = require('./CampaignSelector.jsx');
// const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
// const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');

class AggregateHistory extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.state = {};
    }

    render() {
        let display = null;
        /*
        if (this.state.campaigns) {
            display = <div>
                <CampaignDateRangeTable 
                    startDate={this.state.startDate} startMetrics={this.state.startMetrics}
                    endDate={this.state.endDate} endMetrics={this.state.endMetrics}
                    onRangeChange={this.rangeChange} />
                <CampaignHistoryChart loadData={this.loadData} />
            </div>;
        }
        */

        return <div>
            <CampaignSelector selectGroups={true} campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
            {display}
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ campaigns: selection });
    }
}

AggregateHistory.propTypes = {
    dataPromiseFactory: PropTypes.func.isRequired,
    campaignPromise: PropTypes.object.isRequired,
};

AggregateHistory.defaultProps = {};

module.exports = AggregateHistory;
