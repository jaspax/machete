const _ = require('lodash');
const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');

const common = require('../common/common.js');
const spData = require('../common/sp-data.js');
const constants = require('../common/constants.js');

class CampaignHistoryChart extends React.Component {
    render() {
        const width = this.state ? this.state.width : 800;
        const dataPromise = this.props.dataPromise.then(this.createHistoryData.bind(this));
        const layoutPromise = dataPromise.then(this.createLayout.bind(this));

        return <div style={{width: '100%'}} ref={div => this.containerDiv = div}>
                <TimeSeriesChart
                    width={width} height={600}
                    layout={layoutPromise}
                    dataPromise={dataPromise} />
                <div className="machete-explanation">
                    <p>Impressions, clicks, and reported sales are scaled
                    differently for visibility.</p>

                    <p><b>Hover</b> over any point in the graph to see the raw
                    value.</p>

                    <p><b>Click</b> on a metric name in the legend to enable or disable
                    its display.</p>

                    <p><b>Drag</b> along the x-axis to select a date range.</p>
                </div>
        </div>;
    }

    componentDidMount() {
        this.setState({ width: this.containerDiv.offsetWidth });
    }

    createHistoryData(data) {
        return spData.hasKdpIntegration().then(kdpIntegration => {
            const { aggregate, campaigns, metric } = data;
            this.metric = metric;
            if (metric == 'all')
                return aggregateSeriesAllMetrics(aggregate, kdpIntegration);
            return componentSeriesForMetric(aggregate, campaigns, constants.metric[metric]);
        });
    }

    createLayout(series, metric = this.metric) {
        if (metric == 'all')
            return layoutAllMetrics(series);
        return layoutMetric(series);
    }
}

function aggregateSeriesAllMetrics(data, kdpIntegration) {
    const metrics = [
        _.merge({ options: { yaxis: 'y' } }, constants.metric.impressions),
        _.merge({ options: { yaxis: 'y2' } }, constants.metric.clicks),
        _.merge({ options: { yaxis: 'y3' } }, constants.metric.salesValue),
        _.merge({ options: { yaxis: 'y3' } }, constants.metric.spend),
        _.merge({ options: { yaxis: 'y4' } }, constants.metric.acos),
    ];

    if (kdpIntegration) {
        metrics.push(_.merge({ options: { yaxis: 'y3' } }, constants.metric.knpeValue));
        metrics.push(_.merge({ options: { yaxis: 'y3' } }, constants.metric.knpeTotalValue));
        metrics.push(_.merge({ options: { yaxis: 'y4' } }, constants.metric.knpeAcos));
    }

    const parallel = common.parallelizeSeries(data);
    return metrics.map(metric => common.formatParallelData(parallel, metric));
}

function componentSeriesForMetric(aggregate, campaigns, metric) {
    return [aggregate, ...campaigns].map(data => {
        const parallel = common.parallelizeSeries(data);
        const series = common.formatParallelData(parallel, Object.assign({ name: data[0].campaignName }, metric));
        series.options = {
            mode: 'lines',
            connetctgaps: true,
        };

        if (data == aggregate) {
            series.name = 'Total';
            series.options.mode = 'none';
            series.options.fill = 'tozeroy';
        }

        return series;
    });
}

const baseLayout = {
  margin: { l: 20, b: 40, t: 20, r: 20 },
  legend: {x: 0, y: 1},
  xaxis: {
      autorange: true,
      showgrid: true,
      zeroline: false,
      showline: false,
      autotick: true,
      showticklabels: true
  },
};

function layoutMetric(series) {
    return Object.assign({}, baseLayout, {
        yaxis: {
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: true,
            range: [0, Math.max(...series[0].data)],
        },
    });
}

function layoutAllMetrics(series) {
    const impressions = series.find(x => x.name == constants.metric.impressions.title).data;
    const clicks = series.find(x => x.name == constants.metric.clicks.title).data;
    const spend = series.find(x => x.name == constants.metric.spend.title).data;
    const sales = series.find(x => x.name == constants.metric.salesValue.title).data;
    const acos = series.find(x => x.name == constants.metric.acos.title).data;
    const money = [].concat(...spend).concat(...sales);

    return Object.assign({}, baseLayout, {
        yaxis: { // impressions
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
            range: [0, Math.max(...impressions)],
        },
        yaxis2: { // clicks
            showgrid: false,
            zeroline: false,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
            range: [0, Math.max(...clicks) * 1.2]
        },
        yaxis3: { // sales & spend
            showgrid: false,
            zeroline: false,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
            range: [0, Math.max(...money) * 1.5]
        },
        yaxis4: { // acos
            showgrid: false,
            zeroline: false,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
            range: [0, Math.max(...acos)]
        }
    });
}

CampaignHistoryChart.propTypes = { dataPromise: PropTypes.object.isRequired, };

module.exports = CampaignHistoryChart;
