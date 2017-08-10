const React = require('react');
const PropTypes = require('prop-types');
const Popup = require('./Popup.jsx');
const ThumbnailChart = require('./ThumbnailChart.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');

class HistoryChartPopup extends React.Component {
    render() {
        let content = null;
        if (this.props.allowed) {
            content = <ThumbnailChart 
                metric={this.props.metric} 
                timestamps={this.props.timestamps} 
                data={this.props.data} 
                label={this.props.label} 
                name={this.props.name} />;
        }
        else {
            content = <DataNotAvailable anonymous={this.props.anonymous} />;
        }

        this.popup = <Popup anchorId={this.props.anchorId} show={this.props.show} onDismiss={this.props.onDismiss}>
            {content}
        </Popup>;

        return this.popup;
    }
}

HistoryChartPopup.propTypes = {
    anchorId: PropTypes.string.isRequired,
    show: PropTypes.bool,
    onDismiss: PropTypes.func,
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    metric: PropTypes.string.isRequired,
    timestamps: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
};

module.exports = HistoryChartPopup;
