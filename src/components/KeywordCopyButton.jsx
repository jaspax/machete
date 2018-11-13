const React = require('react');
const PropTypes = require('prop-types');

const Popup = require('./Popup.jsx');
const CampaignSelector = require('./CampaignSelector.jsx');

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
        const dismissPopup = () => this.setState({ showPopup: false });

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
            ? <button className="machete-button" disabled={true}>Copying... <span className="loadingSmall"></span></button>
            : <button className="machete-highlight-button" onClick={this.copyToCampaigns}>Copy</button>; 
        let resultDisplay = null;
        if (this.state.result) {
            resultDisplay = this.state.result.error
                ? <div>We encountered some errors while attempting to copy keywords:
                    <ul>{this.state.result.error.map(x => <li key={x} className="machete-error">{x}</li>)}</ul>
                  </div>
                : <span><span style={{ color: 'green', fontWeight: 'bold' }}>✓</span>&nbsp;Copied</span>;
        }
        return <div>{button}{resultDisplay}</div>;
    }

    campaignSelectorChanged(selected) {
        this.selected = selected;
    }

    async copyToCampaigns() {
        this.setState({ copying: true });
        const result = await this.props.onKeywordCopy(this.selected);
        this.setState({ copying: false, result });
        if (!result.error) {
            setTimeout(() => this.setState({ showPopup: false }), 500);
        }
    }
}

KeywordCopyButton.propTypes = {
    campaignPromise: PropTypes.object.isRequired,
    onKeywordCopy: PropTypes.func.isRequired,
};

module.exports = KeywordCopyButton;
