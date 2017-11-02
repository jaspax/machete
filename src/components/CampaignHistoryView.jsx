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
            startMetrics: { timestamp: Date.now() },
            endDate: moment(),
            endMetrics: { timestamp: Date.now() },
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
        const groupedData = _.groupBy(data, x => x.campaignId);
        const chunkedCampaigns = _.values(groupedData).map(series => common.chunkSeries(series, granularity));
        const combinedChunks = chunkedCampaigns.reduce((array, item) => array.concat(...item), []).sort(common.timestampSort);
        const aggregate = common.chunkSeries(combinedChunks, granularity);

        const startMetrics = aggregate[0] || { timestamp: Date.now() };
        const endMetrics = aggregate[aggregate.length - 1] || { timestamp: Date.now() };
        this.setState({
            granularity,
            startDate: moment(startMetrics.timestamp),
            startMetrics,
            endDate: moment(endMetrics.timestamp),
            endMetrics,
            dataPromise: Promise.resolve(aggregate),
        });
        return aggregate;
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
