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
              // range: [0, maxImpressions * 1.1],
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
          },
          yaxis2: { // clicks
              // range: [0, maxClicks * 1.5],
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
          },
          yaxis3: { // sales
              // range: [0, maxSales * 2],
            showgrid: false,
            zeroline: true,
            showline: true,
            showticklabels: false,
            overlaying: 'y',
          },
        };

        return (
            <div>
                <TimeSeriesChart 
                    width={800} height={600}
                    layout={layout}
                    loadData={this.loadData.bind(this)} />
            </div>
        );
    }

    loadData(cb) {
        this.props.loadData(data => {
            const impressionsData = common.parallelizeHistoryData(data, {rate: 'day', chunk: 'day', metric: 'impressions', round: true});
            const clicksData = common.parallelizeHistoryData(data, {rate: 'day', chunk: 'day', metric: 'clicks', round: true});
            const salesCountData = common.parallelizeHistoryData(data, {rate: 'day', chunk: 'day', metric: 'salesCount'});

            let series = [
                {
                    data: impressionsData.impressions,
                    timestamps: impressionsData.timestamps,
                    name: 'Impressions',
                    options: {
                        mode: 'lines',
                        fill: 'tozeroy',
                        yaxis: 'y',
                        connectgaps: true,
                    }
                },
                {
                    data: clicksData.clicks,
                    timestamps: clicksData.timestamps,
                    name: 'Clicks',
                    options: {
                        mode: 'lines',
                        line: { dash: 'dot', width: 2 },
                        yaxis: 'y2',
                        connectgaps: true,
                    },
                },
                {
                    data: salesCountData.salesCount,
                    timestamps: salesCountData.timestamps,
                    name: 'Sales',
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

