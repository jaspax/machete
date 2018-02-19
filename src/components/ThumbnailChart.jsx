const React = require('react');
const PropTypes = require('prop-types');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');

class ThumbnailChart extends React.Component {
    constructor(props) {
        super(props);
        this.state = this.baseState(props);
    }

    render() {
        return <div>
            <TimeSeriesChart 
                width={400} height={300} title={this.props.title} 
                displayModeBar={false}
                dataPromise={this.state.dataPromise} />
        </div>;
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.baseState(nextProps));
    }

    baseState(props) {
        return { dataPromise: props.dataPromise.then(data => [data]) };
    }
}

ThumbnailChart.propTypes = {
    title: PropTypes.string.isRequired,
    dataPromise: PropTypes.object.isRequired,
};

module.exports = ThumbnailChart;
