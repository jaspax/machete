const React = require('react');
const PropTypes = require('prop-types');
const moment = require('moment');

const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');

class CampaignHistoryView extends React.Component {
    constructor(props) {
        super(props);
        this.rangeChange = this.rangeChange.bind(this);
        this.state = {
            startDate: moment(),
            startMetrics: {},
            endDate: moment(),
            endMetrics: {},
            dataPromise: this.props.dataPromise.then(this.chartDataChanged.bind(this))
        };
    }

    render() {
        return <div>
            <CampaignDateRangeTable 
                startDate={this.state.startDate} startMetrics={this.state.startMetrics}
                endDate={this.state.endDate} endMetrics={this.state.endMetrics}
                onRangeChange={this.rangeChange} />
            <CampaignHistoryChart dataPromise={this.state.dataPromise} />
        </div>;
    }

    rangeChange(range) {
        const filtered = this.state.data.filter(item => item.timestamp >= +range.start && item.timestamp < +range.end);
        this.chartDataChanged(filtered);
    }

    chartDataChanged(data) {
        data = data.sort((a, b) => a.timestamp - b.timestamp);
        const startMetrics = data[0];
        const endMetrics = data[data.length - 1];
        this.setState({
            startDate: moment(startMetrics.timestamp),
            startMetrics,
            endDate: moment(endMetrics.timestamp),
            endMetrics,
            dataPromise: Promise.resolve(data),
        });
        return data;
    }
}

CampaignHistoryView.propTypes = { dataPromise: PropTypes.object.isRequired };

module.exports = CampaignHistoryView;
