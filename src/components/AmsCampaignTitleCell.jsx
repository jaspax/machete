const React = require('react');
const PropTypes = require('prop-types');
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
            statusText = this.state.error;
        }

        return <div>
            <div className="machete-title-cell-title">{this.props.title}</div>
            <div className={statusClass + " machete-ghost"}>{statusText}</div>
        </div>;
    }
}

AmsCampaignTitleCell.propTypes = {
    title: PropTypes.string.isRequired,
    syncPromise: PropTypes.object.isRequired,
};

module.exports = AmsCampaignTitleCell;
