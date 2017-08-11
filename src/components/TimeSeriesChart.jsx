const React = require('react');
const PropTypes = require('prop-types');
const Plotly = require('plotly.js');

let chartCounter = 0;

/*
 * An asynchronously-loaded chart. On first render it shows a loading spinner,
 * and it calls the function passed in the loadData() property, passing in a
 * callback. The loadData() function should do whatever it needs to do to get
 * some data, then call the callback.
 *
 * Argument to the loadData callback argument is an array of objects, each
 * representing one time series. Each object looks like this:
 * {
 *   timestamps: array of timestamps
 *   data: array of data values
 *   name: name of this series
 * }
 *
 * Once the loadData callback has been called, the chart re-renders itself with
 * actual data.
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

        // Initial render we just show the spinner. After initial render we request data.
        if (!(this.state && this.state.data)) {
            return <div id={this.id} style={containerStyle}>
                <div className="loading-large"></div>
            </div>;
        }

        this.series = this.state.data.map(series => ({
          x: series.timestamps,
          y: series.data,
          mode: 'lines+markers',
          name: series.name,
          connectgaps: true
        }));

        this.layout = {
          title: this.props.title,
          width: this.props.width,
          height: this.props.height,
          margin: { l: 40, r: 20, b: 20, t: 40, pad: 4 },
        };

        return <div id={this.id} style={containerStyle}></div>;
    }

    componentDidMount() {
        // On first render, request the data, then update state
        this.props.loadData(data => {
            this.setState({ data });
        });
    }

    componentDidUpdate() {
        // After the state update triggered from componentDidMount, we
        // actually draw the graph
        Plotly.newPlot(this.id, this.series, this.layout, {displayModeBar: this.props.displayModeBar});
    }
}

TimeSeriesChart.propTypes = {
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    loadData: PropTypes.func.isRequired,
    title: PropTypes.string,
    displayModeBar: PropTypes.bool,
};

TimeSeriesChart.defaultProps = {
    displayModeBar: true,
    title: '',
};

module.exports = TimeSeriesChart;
