const React = require('react');
const PropTypes = require('prop-types');
const Plotly = require('plotly.js');
const Async = require('react-promise');
const ErrorSink = require('./ErrorSink.jsx');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

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
    }

    render() {
        const containerStyle = {
            height: this.props.height + 'px',
            width: this.props.width + 'px',
        };

        const layoutPromise = Promise.resolve(this.props.layout);
        const dataPromise = Promise.all([layoutPromise, this.props.dataPromise]);

        return <div id={this.id} style={containerStyle}>
            <Async promise={dataPromise} pending={this.pending(containerStyle)}
                then={this.then.bind(this)} catch={this.catch.bind(this)} />
        </div>;
    }

    pending(style) {
        return <div className="loading-large" style={style}></div>;
    }

    then(results) {
        let [layout, data] = results;
        window.setTimeout(ga.mcatch(() => this.drawGraph(layout, data)));
        return <div>Drawing graph...</div>;
    }

    catch(error) {
        return <ErrorSink error={error} />;
    }

    componentWillReceiveProps() {
        Plotly.purge(this.id);
    }

    drawGraph(layout, data) {
        const series = data.map(series => Object.assign({
            x: series.timestamp,
            y: series.data,
            text: series.data.map(series.format || common.roundFmt),
            hoverinfo: 'text',
            name: series.name,
            mode: 'lines+markers',
            connectgaps: true
        }, series.options));

        layout = Object.assign({
            title: this.props.title,
            width: this.props.width,
            height: this.props.height,
            margin: { l: 40, r: 20, b: 28, t: 40, pad: 4 },
            xaxis: { showticklabels: true }
        }, layout);

        const target = document.getElementById(this.id);
        if (!target) {
            ga.mga('event', 'error-handled', 'plotly-error', 'target element removed before rendering');
            return;
        }

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
