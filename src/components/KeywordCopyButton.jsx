const React = require('react');
const PropTypes = require('prop-types');

const Popup = require('./Popup.jsx');
const CampaignSelector = require('./CampaignSelector.jsx');
const KeywordResultDisplay = require('./KeywordResultDisplay.jsx');

let keywordIdCounter = 0;

class KeywordCopyButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showPopup: false };
        keywordIdCounter++;
        this.id = 'machete-kwcopy-id' + keywordIdCounter;
        this.selected = [];
        this.campaignSelectorChanged = this.campaignSelectorChanged.bind(this);
        this.copyToCampaigns = this.copyToCampaigns.bind(this);
    }

    render() {
        const showPopup = () => this.setState({ showPopup: true });
        const dismissPopup = () => this.setState({ showPopup: false, result: null });

        return <div className="machete-kwcopy" title="Copy these keywords to another campaign...">
            <span className="a-button a-button-small" id={this.id} onClick={showPopup}>
                <span className="a-button-inner">
                    <span className="a-button-text">
                        <span>Copy to another campaign</span>
                    </span>
                </span>
            </span>
            <Popup anchorId={this.id} show={this.state.showPopup} onDismiss={dismissPopup} >
                <div>Select one or more campaigns to copy these keywords with their bids.</div>
                <CampaignSelector campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectorChanged} />
                {this.renderCopyStatus()}
            </Popup>
        </div>;
    }

    renderCopyStatus() {
        const button = this.state.copying
            ? <button className="machete-button" disabled={true}>Copying... <span className="loading-small"></span></button>
            : <button className="machete-highlight-button" onClick={this.copyToCampaigns}>Copy</button>; 

        const resultDisplay = this.state.result
            ? <KeywordResultDisplay ok={this.state.result.ok} fail={this.state.result.fail} />
            : null;

        return <div>{button}{resultDisplay}</div>;
    }
    
    campaignSelectorChanged(selected) {
        this.selected = selected;
    }

    async copyToCampaigns() {
        this.setState({ copying: true, result: null });
        const result = await this.props.onKeywordCopy(this.selected);
        this.setState({ copying: false, result });
    }
}

KeywordCopyButton.propTypes = {
    campaignPromise: PropTypes.object.isRequired,
    onKeywordCopy: PropTypes.func.isRequired,
};

module.exports = KeywordCopyButton;
