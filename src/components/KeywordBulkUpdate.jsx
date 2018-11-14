const React = require('react');
const PropTypes = require('prop-types');

const ErrorBoundary = require('./ErrorBoundary.jsx');
const KeywordEnableToggle = require('./KeywordEnableToggle.jsx');
const KeywordBidUpdate = require('./KeywordBidUpdate.jsx');
const KeywordCopyButton = require('./KeywordCopyButton.jsx');

const ga = require('../common/ga.js');

class KeywordBulkUpdate extends React.Component {
    constructor(props) {
        super(props);
        this.handleEnabledChange = this.handleEnabledChange.bind(this);
        this.handleBidChange = this.handleBidChange.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
    }

    render() {
        const enabled = this.props.data.length ? this.props.data[0].enabled : false;
        const bid = this.props.data.length ? Number(this.props.data[0].bid) : 0;
        return <ErrorBoundary>
            <div className="machete-kwupdate-bulk">
                <div className="machete-kwbulk-label">Bulk update {this.props.data.length} keywords</div>
                <KeywordEnableToggle enabled={enabled} onKeywordEnabledChange={this.handleEnabledChange} />
                <KeywordBidUpdate bid={bid} onKeywordBidChange={this.handleBidChange} />
                <KeywordCopyButton campaignPromise={this.props.campaignPromise} onKeywordCopy={this.handleCopy} />
            </div>
        </ErrorBoundary>;
    }

    handleEnabledChange(enabled) {
        ga.revent('kwBulkUpdate', { type: 'enable', value: enabled });
        return this.props.onKeywordEnabledChange(enabled, this.props.data);
    }

    handleBidChange(bid) {
        ga.revent('kwBulkUpdate', { type: 'bid', value: bid });
        return this.props.onKeywordBidChange(bid, this.props.data);
    }

    handleCopy(campaigns) {
        ga.revent('kwBulkCopy');
        return this.props.onKeywordCopy(campaigns, this.props.data);
    }
}

KeywordBulkUpdate.propTypes = {
    data: PropTypes.array.isRequired,
    campaignPromise: PropTypes.object.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
    onKeywordCopy: PropTypes.func.isRequired,
};

module.exports = KeywordBulkUpdate;
