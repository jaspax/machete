const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');

const common = require('../common/common.js');

class CampaignHistoryChart extends React.Component {
    render() {
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
          },
          yaxis2: { // clicks
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
          },
          yaxis3: { // sales & spend
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
          },

        };

        const width = this.state ? this.state.width : 800;

        return (
            <div style={{width: '100%'}} ref={div => this.containerDiv = div}>
                <TimeSeriesChart
                    width={width} height={600}
                    layout={layout}
                    loadData={this.loadData.bind(this)} />
            </div>
        );
    }

    componentDidMount() {
        this.setState({ width: this.containerDiv.offsetWidth });
    }

    loadData(cb) {
        this.props.loadData(data => {
            const parallel = common.parallelizeSeries(data);

            let series = [
                {
                    data: parallel.impressions,
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
                    data: parallel.clicks,
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
                    data: parallel.salesValue,
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
                    data: parallel.spend,
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

            cb(series);
        });
    }
}

CampaignHistoryChart.propTypes = { loadData: PropTypes.func.isRequired };

module.exports = CampaignHistoryChart;

