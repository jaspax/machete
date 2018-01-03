const React = require('react');
const PropTypes = require('prop-types');
const moment = require('moment');
const csv = require('csv-stringify');
const $ = require('jquery');
const _ = require('lodash');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

const DownloadButton = require('./DownloadButton.jsx');
const CampaignDateRangeTable = require('./CampaignDateRangeTable.jsx');
const CampaignHistoryChart = require('./CampaignHistoryChart.jsx');
const TimeSeriesGranularitySelector = require('./TimeSeriesGranularitySelector.jsx');
const MetricSelector = require('./MetricSelector.jsx');

class CampaignHistoryView extends React.Component {
    constructor(props) {
        super(props);
        this.rangeChange = this.rangeChange.bind(this);
        this.state = this.baseState(props);
    }

    render() {
        return <div>
            <DownloadButton title="Download complete history" onClick={this.generateDownloadCsv.bind(this)} />
            <TimeSeriesGranularitySelector value={this.state.granularity} onChange={this.granularityChange.bind(this)} />
            <MetricSelector selected={this.state.metric} onChange={this.metricSelectionChange.bind(this)} />
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
            metric: 'all',
            startDate: moment(),
            startMetrics: { timestamp: Date.now() },
            endDate: moment(),
            endMetrics: { timestamp: Date.now() },
            dataPromise: props.dataPromise.then(data => {
                this.setState({ data });
                return this.chartDataChanged(data, this.state.granularity, this.state.metric);
            })
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.baseState(nextProps));
    }

    granularityChange(granularity) {
        this.chartDataChanged(this.state.data, granularity, this.state.metric);
    }

    rangeChange(range) {
        const filtered = this.state.data.filter(item => item.timestamp >= +range.start && item.timestamp < +range.end);
        this.chartDataChanged(filtered, this.state.granularity, this.state.metric);
    }

    metricSelectionChange(selection) {
        this.chartDataChanged(this.state.data, this.state.granularity, selection);
    }

    chartDataChanged(data, granularity, metric) {
        const groupedData = _.groupBy(data, x => x.campaignId);
        const campaigns = _.values(groupedData).map(series => common.chunkSeries(series, granularity));
        const aggregate = common.aggregateSeries(campaigns, granularity);

        const startMetrics = aggregate[0] || { timestamp: Date.now() };
        const endMetrics = aggregate[aggregate.length - 1] || { timestamp: Date.now() };
        this.setState({
            data,
            granularity,
            metric,
            startDate: moment(startMetrics.timestamp),
            startMetrics,
            endDate: moment(endMetrics.timestamp),
            endMetrics,
            dataPromise: Promise.resolve({ aggregate, campaigns, metric }),
        });
        return { aggregate, campaigns, metric };
    }

    generateDownloadCsv(evt) {
        evt.preventDefault();
        if (!this.state.data) {
            return;
        }
        const data = this.state.data.map(x => ({
            "Campaign Name": x.campaignName || '',
            "Campaign Id": x.campaignId || '',
            "Timestamp": moment(x.timestamp).format('YYYY-MM-DD HH:mm'),
            "Impressions": x.impressions,
            "Clicks": x.clicks,
            "Sales (units)": x.salesCount,
            "Sales (value)": common.numberFmt(x.salesValue),
            "Spend": common.numberFmt(x.spend),
            "ACOS": common.numberFmt(x.acos),
            "Average CPC": common.numberFmt(x.avgCpc),
        }));
        csv(data, { header: true }, (error, data) => {
            if (error) {
                // TODO: report errors
                return ga.merror(error);
            }
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            $(`<a href='${url}' download='CampaignHistory.csv'></a>`)[0].click();

            return url;
        });
    }
}

CampaignHistoryView.propTypes = { dataPromise: PropTypes.object.isRequired };

module.exports = CampaignHistoryView;
