const _ = require('lodash');

const React = require('react');
const Popup = require('./Popup.jsx');
const ThumbnailChart = require('./ThumbnailChart.jsx');
const DataNotAvailable = require('./DataNotAvailable.jsx');

module.exports = class HistoryChartPopup extends React.Component {
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
                name={this.props.name} />
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
};
