const React = require('react');
const PropTypes = require('prop-types');
const Plotly = require('plotly.js');
const DataNotAvailable = require('./DataNotAvailable.jsx');
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
        this.drawGraph = this.drawGraph.bind(this);
        this.handleError = this.handleError.bind(this);
        this.state = {};
    }

    render() {
        const containerStyle = {
            height: this.props.height + 'px',
            width: this.props.width + 'px',
        };

        let content = null;
        if (this.state.error) {
            content = <DataNotAvailable allowed={!this.state.error.notAllowed} anonymous={this.state.error.notLoggedIn} />;
        }

        return <div id={this.id} style={containerStyle} className="loading-large">{content}</div>;
    }

    handleError(error) {
        this.setState({ error });
    }

    componentDidMount() {
        this.props.dataPromise.then(this.drawGraph).catch(this.handleError);
    }

    componentWillReceiveProps() {
        Plotly.purge(this.id);
    }

    componentDidUpdate() {
        this.props.dataPromise.then(this.drawGraph).catch(this.handleError);
    }

    drawGraph(data) {
        const series = data.map(series => Object.assign(
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

        const layout = Object.assign(
            {
                title: this.props.title,
                width: this.props.width,
                height: this.props.height,
                margin: { l: 40, r: 20, b: 28, t: 40, pad: 4 },
                xaxis: { showticklabels: true }
            },
            this.props.layout);

        Plotly.newPlot(this.id, series, layout, {displayModeBar: this.props.displayModeBar});
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
