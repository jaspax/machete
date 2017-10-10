const React = require('react');
const PropTypes = require('prop-types');
const Plotly = require('plotly.js');

const common = require('../common/common.js');

let chartCounter = 0;

class KeywordBubbleChart extends React.Component {
    constructor(props) {
        super(props);
        chartCounter++;
        this.id = "KeywordBubbleChart" + chartCounter;
    }

    render() {
        const chartStyle = {
            width: this.props.width,
            height: this.props.height,
        };
        return <div style={chartStyle} id={this.id}></div>;
    }

    shouldComponentUpdate() {
        // Only render when transitioning from no data => data, otherwise treat
        // the chart as static.
        if (this.props.keywordData && this.props.keywordData.impressions.length)
            return false;
        return true;
    }

    componentDidMount() {
        this.renderChart();
    }

    componentDidUpdate() {
        this.renderChart();
    }

    renderChart() {
        let kws = this.props.keywordData;
        let chartData = {
            mode: 'markers',
            x: kws.impressions,
            y: kws.clicks,
            text: kws.kw.map((kw, i) =>
                `"${kw}"<br />Impressions: ${kws.impressions[i]}<br />Clicks: ${kws.clicks[i]}<br />Avg CPC: ${common.moneyFmt(kws.avgCpc[i])}<br />ACOS: ${common.pctFmt(kws.acos[i])}`),
            hoverinfo: 'text',
            marker: {
                sizemode: 'area',
                sizeref: Math.max.apply(null, kws.spend) / 2000,
                size: kws.spend,
                color: kws.acos,
                colorscale: [[0, 'rgb(0, 255, 0)'], [0.5, 'rgb(255, 255, 0)'], [1, 'rgb(255, 0, 0)']],
            },
        };
        let layout = {
            xaxis: {title: 'Impressions'},
            yaxis: {title: 'Clicks'},
            margin: { l: 40, r: 20, b: 40, t: 20, pad: 4 },
            height: this.props.height,
            width: this.props.width,
            hovermode: 'closest',
            showlegend: false,
        };
        Plotly.newPlot(this.id, [chartData], layout, {showLink: false});
    }
}

KeywordBubbleChart.propTypes = {
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    keywordData: PropTypes.object,
};

module.exports = KeywordBubbleChart;
