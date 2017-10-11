const React = require('react');
const PropTypes = require('prop-types');

const KeywordEnableToggle = require('./KeywordEnableToggle.jsx');
const KeywordBidUpdate = require('./KeywordBidUpdate.jsx');

class KeywordBulkUpdate extends React.Component {
    constructor(props) {
        super(props);
        this.handleEnabledChange = this.handleEnabledChange.bind(this);
        this.handleBidChange = this.handleBidChange.bind(this);
    }

    render() {
        const enabled = this.props.data.length ? this.props.data[0].enabled : false;
        const bid = this.props.data.length ? Number(this.props.data[0].bid) : 0;
        return (
            <div className="machete-kwupdate-bulk">
                <div className="machete-kwbulk-label">Bulk update {this.props.data.length} keywords</div>
                <KeywordEnableToggle enabled={enabled} onChange={this.handleEnabledChange} />
                <KeywordBidUpdate bid={bid} onChange={this.handleBidChange} />
            </div>
        );
    }

    handleEnabledChange(enabled) {
        this.props.onEnabledChange(enabled, this.props.data);
    }

    handleBidChange(bid) {
        this.props.onBidChange(bid, this.props.data);
    }
}

KeywordBulkUpdate.propTypes = {
    data: PropTypes.array.isRequired,
    onEnabledChange: PropTypes.func.isRequired,
    onBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordBulkUpdate;
