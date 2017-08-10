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
                label={this.props.label} 
                name={this.props.name} 
                loadData={this.props.loadData} />;
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
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    loadData: PropTypes.func.isRequired,
};

module.exports = HistoryChartPopup;
