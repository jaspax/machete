const React = require('react');
const Plotly = require('plotly.js');
const PropTypes = require('prop-types');

const loDataHref = chrome.runtime.getURL('html/low-data.html');

class ThumbnailChart extends React.Component {
    render() {
        // Initial render we are blank. After initial render we request data.
        if (!(this.state && this.state.timestamps))
            return null;

        const props = this.props;
        this.id = props.metric + Date.now();

        this.series = {
          x: this.state.timestamps,
          y: this.state.data,
          mode: 'lines+markers',
          name: props.metric,
          connectgaps: true
        };

        let height = 300;
        if (this.series.x.length < 4) {
            height = 270; // leaving room for the lodata link
        }

        this.layout = {
          title: `${props.label}<br />${props.name}`,
          width: 400,
          height,
          margin: { l: 40, r: 20, b: 25, t: 60, pad: 4 },
        };

        let lodata = null;
        if (this.series.x.length < 4) {
            lodata = <p>
                <a data-mclick="thumbnail-lodata" className="machete-lodata" target="_blank" href={loDataHref}>Why don&rsquo;t I see any data?</a>
            </p>;
        }
        return <div id={this.id}>{lodata}</div>;
    }

    componentDidMount() {
        // On first render, request the data, then update state
        this.props.loadData(data => {
            this.setState({ timestamps: data.timestamps, data: data[this.props.metric] });
        });
    }

    componentDidUpdate() {
        // After the state update triggered from componentDidMount, we
        // actually draw the graph
        Plotly.newPlot(this.id, [this.series], this.layout, {displayModeBar: false});
    }
}

ThumbnailChart.propTypes = {
    metric: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    loadData: PropTypes.func.isRequired,
};

module.exports = ThumbnailChart;
