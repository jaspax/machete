const React = require('react');
const PropTypes = require('prop-types');
const moment = require('moment');

const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');
const DataNotAvailable = require('../components/DataNotAvailable.jsx');
const DownloadButton = require('../components/DownloadButton.jsx');

class CampaignHistoryTab extends React.Component {
    constructor(props) {
        super(props);
        this.rangeChange = this.rangeChange.bind(this);
        this.loadData = this.loadData.bind(this);
        this.state = {
            startDate: moment(),
            startMetrics: {},
            endDate: moment(),
            endMetrics: {},
        };
    }

    render() {
        if (!this.props.allowed) {
            return <DataNotAvailable allowed={false} anonymous={window.user.isAnon} />;
        }

        return (
            <div className="a-box-inner">
                <h1>Campaign History</h1>

                <div id="machete-campaign-history-download-container">
                    <DownloadButton href={this.props.downloadHref} title="Click to download campaign history" />
                </div>

                <CampaignDateRangeTable 
                    startDate={this.state.startDate} startMetrics={this.state.startMetrics}
                    endDate={this.state.endDate} endMetrics={this.state.endMetrics}
                    onRangeChange={this.rangeChange} />

                <CampaignHistoryChart loadData={this.loadData} />
                <div className="machete-explanation">
                    <p>Impressions, clicks, and reported sales are scaled
                    differently for visibility.</p>
                    
                    <p><b>Hover</b> over any point in the graph to see the raw
                    value.</p>

                    <p><b>Click</b> on a metric name in the legend to enable or disable
                    its display.</p>

                    <p><b>Drag</b> along the x-axis to select a date range.</p>
                </div>
            </div>
        );
    }

    rangeChange(range) {
        const filtered = this.state.data.filter(item => item.timestamp >= +range.start && item.timestamp < +range.end);
        this.updateState(filtered);
    }

    loadData(chartDataChanged) {
        this.props.loadData(data => {
            this.setState({ data, chartDataChanged, });
            this.updateState(data);
        });
    }

    updateState(data) {
        data = data.sort((a, b) => a.timestamp - b.timestamp);
        const startMetrics = data[0];
        const endMetrics = data[data.length - 1];
        this.setState({
            startDate: moment(startMetrics.timestamp),
            startMetrics,
            endDate: moment(endMetrics.timestamp),
            endMetrics,
        });
        this.state.chartDataChanged(data);
    }
}

CampaignHistoryTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    downloadHref: PropTypes.string.isRequired,
    loadData: PropTypes.func.isRequired,
};

module.exports = CampaignHistoryTab;
