const React = require('react');
const Plotly = require('plotly.js');

const loDataHref = chrome.runtime.getURL('html/low-data.html')

module.exports = class ThumbnailChart extends React.Component {
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
        const lodata = (this.series.x.length < 4
            ? <p><a data-mclick="thumbnail-lodata" className="machete-lodata" target="_blank" href={loDataHref}>Why don't I see any data?</a></p>
            : null);
        return <div id={this.id}>{lodata}</div>
    }
};
