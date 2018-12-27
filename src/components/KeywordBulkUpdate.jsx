const React = require('react');
const PropTypes = require('prop-types');

const ErrorBoundary = require('./ErrorBoundary.jsx');
const KeywordBidUpdate = require('./KeywordBidUpdate.jsx');
const KeywordCopyButton = require('./KeywordCopyButton.jsx');
const KeywordEnableToggle = require('./KeywordEnableToggle.jsx');
const KeywordResultDisplay = require('./KeywordResultDisplay.jsx');
const Popup = require('./Popup.jsx');

const ga = require('../common/ga.js');

let bulkIdCounter = 0;

class KeywordBulkUpdate extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showPopup: false, result: null };
        this.handleEnabledChange = this.handleEnabledChange.bind(this);
        this.handleBidChange = this.handleBidChange.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.id = ++bulkIdCounter;
    }

    render() {
        const dismissPopup = () => this.setState({ showPopup: false, result: null });
        const enabled = this.props.data.length ? this.props.data[0].enabled : false;
        const bid = this.props.data.length ? Number(this.props.data[0].bid) : 0;
        const ok = this.state.result ? this.state.result.ok : [];
        const fail = this.state.result ? this.state.result.fail : [];

        return <ErrorBoundary>
            <div className="machete-kwupdate-bulk" id={this.id}>
                <div className="machete-kwbulk-label">Bulk update {this.props.data.length} keywords</div>
                <KeywordEnableToggle enabled={enabled} onKeywordEnabledChange={this.handleEnabledChange} />
                <KeywordBidUpdate bid={bid} onKeywordBidChange={this.handleBidChange} />
                <KeywordCopyButton campaignPromise={this.props.campaignPromise} onKeywordCopy={this.handleCopy} />
            </div>
            <Popup anchorId={this.id} show={this.state.showPopup} onDismiss={dismissPopup} >
                <KeywordResultDisplay ok={ok} fail={fail} />
            </Popup>
        </ErrorBoundary>;
    }

    async handleEnabledChange(enabled) {
        ga.revent('kwBulkUpdate', { type: 'enable', value: enabled });
        const result = await this.props.onKeywordEnabledChange(enabled, this.props.data);
        this.setState({ showPopup: true, result });
    }

    async handleBidChange(bid) {
        ga.revent('kwBulkUpdate', { type: 'bid', value: bid });
        const result = await this.props.onKeywordBidChange(bid, this.props.data);
        this.setState({ showPopup: true, result });
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
