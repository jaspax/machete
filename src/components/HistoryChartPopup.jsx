const React = require('react');
const PropTypes = require('prop-types');
const Popup = require('./Popup.jsx');
const ThumbnailChart = require('./ThumbnailChart.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');

function HistoryChartPopup(props) {
    let content = null;
    if (props.allowed) {
        content = <ThumbnailChart 
            title={props.title} 
            dataPromise={props.dataPromise} />;
    }
    else {
        content = <DataNotAvailable anonymous={props.anonymous} />;
    }

    return <Popup anchorId={props.anchorId} show={props.show} onDismiss={props.onDismiss}>
        {content}
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
