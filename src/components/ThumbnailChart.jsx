const React = require('react');
const Plotly = require('plotly.js');
const PropTypes = require('prop-types');

const loDataHref = chrome.runtime.getURL('html/low-data.html');

class ThumbnailChart extends React.Component {
    constructor(props) {
        super(props);
        this.id = props.metric + Date.now();

        this.series = {
          x: props.timestamps,
          y: props.data,
          mode: 'lines+markers',
          name: props.metric,
          connectgaps: true
        };

        let height = 300;
        if (props.timestamps.length < 3) {
            height = 270; // leaving room for the lodata link
        }

        this.layout = {
          title: `${props.label}<br />${props.name}`,
          width: 400,
          height,
          margin: { l: 40, r: 20, b: 25, t: 60, pad: 4 },
        };
    }

    componentDidMount() {
        Plotly.newPlot(this.id, [this.series], this.layout, {displayModeBar: false});
    }

    render() {
        let lodata = null;
        if (this.series.x.length < 4) {
            lodata = <p>
                <a data-mclick="thumbnail-lodata" className="machete-lodata" target="_blank" href={loDataHref}>Why don&rsquo;t I see any data?</a>
            </p>;
        }
        return <div id={this.id}>{lodata}</div>;
    }
}

ThumbnailChart.propTypes = {
    metric: PropTypes.string.isRequired,
    timestamps: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
};

module.exports = ThumbnailChart;
