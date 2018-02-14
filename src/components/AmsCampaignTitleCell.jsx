const React = require('react');
const PropTypes = require('prop-types');
const ErrorBoundary = require('./ErrorBoundary.jsx');
const moment = require('moment');

class AmsCampaignTitleCell extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        props.syncPromise.then(
            syncTimestamp => this.setState({ syncTimestamp }),
            error => this.setState({ error })
        );
    }

    render() {
        let statusClass = 'loading-small';
        let statusText = 'Syncing now';
        if (this.state.syncTimestamp) {
            statusClass = '';
            statusText = `Synced ` + moment(this.state.syncTimestamp).format('MMM D, h:mma');
        }
        else if (this.state.error) {
            statusClass = 'machete-title-cell-error';
            statusText = this.state.error.message;
        }

        const statusStyle = {
            display: 'inline-block',
            marginLeft: '4px',
            verticalAlign: 'middle',
        };

        return <ErrorBoundary>
            <div className="machete-title-cell-title">{this.props.title}</div>
            <div className="machete-title-cell-status">
                <div className={statusClass} style={statusStyle}></div>
                <div className="machete-ghost" style={statusStyle}>{statusText}</div>
            </div>
        </ErrorBoundary>;
    }
}

AmsCampaignTitleCell.propTypes = {
    title: PropTypes.string.isRequired,
    syncPromise: PropTypes.object.isRequired,
};

module.exports = AmsCampaignTitleCell;
