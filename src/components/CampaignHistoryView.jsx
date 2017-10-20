const React = require('react');
const PropTypes = require('prop-types');
const moment = require('moment');
const common = require('../common/common.js');

const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');
const TimeSeriesGranularitySelector = require('./TimeSeriesGranularitySelector.jsx');

class CampaignHistoryView extends React.Component {
    constructor(props) {
        super(props);
        this.rangeChange = this.rangeChange.bind(this);
        this.state = this.baseState(props);
    }

    render() {
        return <div>
            <TimeSeriesGranularitySelector value={this.state.granularity} onChange={this.granularityChange.bind(this)} />
            <CampaignDateRangeTable
                startDate={this.state.startDate} startMetrics={this.state.startMetrics}
                endDate={this.state.endDate} endMetrics={this.state.endMetrics}
                onRangeChange={this.rangeChange} />
            <CampaignHistoryChart dataPromise={this.state.dataPromise} />
        </div>;
    }

    baseState(props) {
        return {
            granularity: 'day',
            startDate: moment(),
            startMetrics: {},
            endDate: moment(),
            endMetrics: {},
            dataPromise: props.dataPromise.then(data => {
                this.setState({ data });
                return this.chartDataChanged(data, this.state.granularity);
            })
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.baseState(nextProps));
    }

    granularityChange(granularity) {
        this.chartDataChanged(this.state.data, granularity);
    }

    rangeChange(range) {
        const filtered = this.state.data.filter(item => item.timestamp >= +range.start && item.timestamp < +range.end);
        this.chartDataChanged(filtered, this.state.granularity);
    }

    chartDataChanged(data, granularity) {
        data = data.sort((a, b) => a.timestamp - b.timestamp);
        data = common.chunkSeries(data, granularity);
        const startMetrics = data[0] || { timestamp: Date.now() };
        const endMetrics = data[data.length - 1] || { timestamp: Date.now() };
        this.setState({
            granularity,
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
