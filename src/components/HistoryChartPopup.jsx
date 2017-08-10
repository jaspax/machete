const _ = require('lodash');

const React = require('react');
const PropTypes = require('prop-types');
const Popup = require('./Popup.jsx');
const ThumbnailChart = require('./ThumbnailChart.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');

class HistoryChartPopup extends React.Component {
    constructor(props) {
        super(props);
        this.state = _.pick(props, ['allowed', 'anonymous', 'show']);
    }

    render() {
        let content = null;
        if (this.state.allowed) {
            content = <ThumbnailChart 
                metric={this.props.metric} 
                timestamps={this.props.timestamps} 
                data={this.props.data} 
                label={this.props.label} 
                name={this.props.name} />;
        }
        else {
            content = <DataNotAvailable anonymous={this.state.anonymous} />;
        }

        return (
            <Popup show={this.state.show} anchor={this.props.anchor}>
                {content}
            </Popup>
        );
    }
}

HistoryChartPopup.propTypes = {
    anchor: PropTypes.object.isRequired,
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    show: PropTypes.bool,
    metric: PropTypes.string.isRequired,
    timestamps: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
};

module.exports = HistoryChartPopup;
