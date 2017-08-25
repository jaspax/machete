const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');
const process = require('process');

const loDataHref = chrome.runtime.getURL('html/low-data.html');

class ThumbnailChart extends React.Component {
    render() {
        let height = 300;
        let lodata = null;

        if (this.state && this.state.lodata) {
            height = 270; // leaving room for the lodata link
            if (process.env.PRODUCT == 'selfpub') {
                lodata = <p>
                    <a data-mclick="thumbnail-lodata" className="machete-lodata" target="_blank" href={loDataHref}>Why don&rsquo;t I see any data?</a>
                </p>;
            }
            else {
                lodata = <p>Machete is still downloading your data from Amazon.</p>;
            }
        }

        return (
            <div>
                <TimeSeriesChart 
                    width={400} height={height} title={this.props.title} 
                    displayModeBar={false}
                    loadData={this.loadData.bind(this)} />
                {lodata}
            </div>
        );
    }

    loadData(cb) {
        this.props.loadData(data => {
            if (data.timestamp.length < 4) {
                this.setState({ lodata: true });
            }
            cb([data]);
        });
    }
}

ThumbnailChart.propTypes = {
    title: PropTypes.string.isRequired,
    loadData: PropTypes.func.isRequired,
};

module.exports = ThumbnailChart;
