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
                title={this.props.title} 
                dataPromise={this.props.dataPromise} />;
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
    title: PropTypes.string.isRequired,
    dataPromise: PropTypes.object.isRequired,
};

module.exports = HistoryChartPopup;
