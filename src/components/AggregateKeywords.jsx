const React = require('react');
const PropTypes = require('prop-types');

const ErrorBoundary = require('./ErrorBoundary.jsx');
const CampaignSelector = require('./CampaignSelector.jsx');
const KeywordAnalysis = require('./KeywordAnalysis.jsx');
const ga = require('../common/ga.js');

class AggregateKeywords extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.state = {};
    }

    render() {
        ga.revent('viewAggregateKeywords');
        let display = null;
        if (this.state.dataPromise) {
            display = <section>
                <div className="machete-warning"><b>Caution:</b> Updates made to
                    keywords in this view will affect all campaigns selected above.</div>
                <KeywordAnalysis 
                    dataPromise={this.state.dataPromise} 
                    campaignPromise={this.props.campaignPromise}
                    updateStatus={this.props.updateStatus} 
                    updateBid={this.props.updateBid} 
                    copyKeywords={this.props.copyKeywords}
                />
            </section>;
        }

        return <div className="a-box-inner">
            <h1>Aggregate Keywords</h1>
            <ErrorBoundary>
                <section className="machete-campaign-selector">
                    <b>Select campaigns:</b>
                    <CampaignSelector campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
                </section>
                {display}
            </ErrorBoundary>
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ dataPromise: this.props.loadDataPromise(selection) });
    }
}

AggregateKeywords.propTypes = {
    loadDataPromise: PropTypes.func.isRequired,
    campaignPromise: PropTypes.object.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
    copyKeywords: PropTypes.func.isRequired,
};

module.exports = AggregateKeywords;
