const React = require('react');
const PropTypes = require('prop-types');
const Popup = require('./Popup.jsx');
const ThumbnailChart = require('./ThumbnailChart.jsx');

function HistoryChartPopup(props) {
    return <Popup anchorId={props.anchorId} show={props.show} onDismiss={props.onDismiss}>
        <ThumbnailChart title={props.title} dataPromise={props.dataPromise} />
    </Popup>;
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
