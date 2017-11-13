const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');
const process = require('process');

const loDataHref = chrome.runtime.getURL('html/low-data.html');

class ThumbnailChart extends React.Component {
    constructor(props) {
        super(props);
        this.state = this.baseState(props);
    }

    render() {
        let height = 300;
        let lodata = null;

        if (this.state.lodata) {
            height = 270; // leaving room for the lodata link
            if (process.env.PRODUCT == 'sp') {
                lodata = <p>
                    <a data-mclick="thumbnail-lodata" className="machete-lodata" target="_blank" href={loDataHref}>Why don&rsquo;t I see any data?</a>
                </p>;
            }
            else {
                lodata = <p>Machete is still downloading your data from Amazon.</p>;
            }
        }

        return <div>
            <TimeSeriesChart 
                width={400} height={height} title={this.props.title} 
                displayModeBar={false}
                dataPromise={this.state.dataPromise} />
            {lodata}
        </div>;
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.baseState(nextProps));
    }

    baseState(props) {
        return { 
            dataPromise: props.dataPromise.then(data => {
                if (data && data.timestamp.length < 4) {
                    this.setState({ lodata: true });
                }
                return [data];
            })
        };
    }
}

ThumbnailChart.propTypes = {
    title: PropTypes.string.isRequired,
    dataPromise: PropTypes.object.isRequired,
};

module.exports = ThumbnailChart;
