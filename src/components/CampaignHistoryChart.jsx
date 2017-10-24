const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');

const common = require('../common/common.js');

class CampaignHistoryChart extends React.Component {
    render() {
        const width = this.state ? this.state.width : 800;
        const dataPromise = this.props.dataPromise.then(createHistoryData);
        const layoutPromise = dataPromise.then(createLayout);

        return (
            <div style={{width: '100%'}} ref={div => this.containerDiv = div}>
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
            </div>
        );
    }

    componentDidMount() {
        this.setState({ width: this.containerDiv.offsetWidth });
    }
}

function createHistoryData(data) {
    const parallel = common.parallelizeSeries(data);

    let series = [
        {
            data: parallel.impressions || [],
            timestamp: parallel.timestamp,
            name: 'Impressions',
            options: {
                mode: 'lines',
                fill: 'tozeroy',
                yaxis: 'y',
                connectgaps: true,
            }
        },
        {
            data: parallel.clicks || [],
            timestamp: parallel.timestamp,
            name: 'Clicks',
            options: {
                mode: 'lines',
                line: { dash: 'dot', width: 2 },
                yaxis: 'y2',
                connectgaps: true,
            },
        },
        {
            data: parallel.salesValue || [],
            timestamp: parallel.timestamp,
            format: common.moneyFmt,
            name: 'Sales',
            options: {
                mode: 'lines',
                yaxis: 'y3',
                connectgaps: true,
            }, 
        },
        {
            data: parallel.spend || [],
            timestamp: parallel.timestamp,
            format: common.moneyFmt,
            name: 'Spend',
            options: {
                mode: 'lines',
                yaxis: 'y3',
                connectgaps: true,
            }, 
        },
    ];

    return series;
}

function createLayout(series) {
    const impressions = series.find(x => x.name == 'Impressions').data;
    const clicks = series.find(x => x.name == 'Clicks').data;
    const spend = series.find(x => x.name == 'Spend').data;
    const sales = series.find(x => x.name == 'Sales').data;
    const money = [].concat(...spend).concat(...sales);

    var layout = {
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
    };

    return layout;
}

CampaignHistoryChart.propTypes = { dataPromise: PropTypes.object.isRequired };

module.exports = CampaignHistoryChart;

