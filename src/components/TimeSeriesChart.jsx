const React = require('react');
const PropTypes = require('prop-types');
const Plotly = require('plotly.js');
const common = require('../common/common.js');

let chartCounter = 0;

/*
 * An asynchronously-loaded chart. On first render it shows a loading spinner,
 * when the dataPromise is resolved the chart is updated with new data.
 *
 * The value resolved from dataPromise is an array of objects, each representing
 * one time series. Each object looks like this:
 *
 * {
 *   timestamp: array of timestamps
 *   data: array of data values
 *   name: name of this series
 * }
 */
class TimeSeriesChart extends React.Component {
    constructor(props) {
        super(props);
        chartCounter++;
        this.id = 'TimeSeriesChart' + chartCounter;
        this.state = {};
        this.props.dataPromise.then(data => this.setState({ data }));
    }

    render() {
        const containerStyle = {
            height: this.props.height + 'px',
            width: this.props.width + 'px',
        };

        // Initial render we just show the spinner. After initial render we request data.
        if (!this.state.data) {
            return <div id={this.id} style={containerStyle} className="loading-large"></div>;
        }

        this.series = this.state.data.map(series => Object.assign(
            {
                x: series.timestamp,
                y: series.data,
                text: series.data.map(series.format || common.roundFmt),
                hoverinfo: 'text',
                name: series.name,
                mode: 'lines+markers',
                connectgaps: true
            }, 
            series.options));

        this.layout = Object.assign(
            {
                title: this.props.title,
                width: this.props.width,
                height: this.props.height,
                margin: { l: 40, r: 20, b: 28, t: 40, pad: 4 },
                xaxis: { showticklabels: true }
            },
            this.props.layout);

        return <div id={this.id} style={containerStyle}></div>;
    }

    componentWillReceiveProps() {
        this.setState({});
    }

    componentDidUpdate() {
        if (this.state.data) {
            // After the state update triggered from the data completion
            Plotly.newPlot(this.id, this.series, this.layout, {displayModeBar: this.props.displayModeBar});
        }
        else {
            this.props.dataPromise.then(data => this.setState({ data }));
        }
    }
}

TimeSeriesChart.propTypes = {
    height: PropTypes.number,
    width: PropTypes.number.isRequired,
    dataPromise: PropTypes.object.isRequired,
    title: PropTypes.string,
    displayModeBar: PropTypes.bool,
    layout: PropTypes.object,
};

TimeSeriesChart.defaultProps = {
    displayModeBar: true,
    title: '',
    layout: {},
};

module.exports = TimeSeriesChart;
