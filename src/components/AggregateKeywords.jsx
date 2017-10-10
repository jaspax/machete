const React = require('react');
const PropTypes = require('prop-types');

const CampaignSelector = require('./CampaignSelector.jsx');
const KeywordAnalysis = require('./KeywordAnalysis.jsx');

class AggregateKeywords extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.state = {};
    }

    render() {
        let display = null;
        if (this.state.dataPromise) {
            display = <KeywordAnalysis dataPromise={this.state.dataPromise} 
                updateStatus={this.props.updateStatus} updateBid={this.props.updateBid} />;
        }

        return <div className="a-box-inner">
            <h1>Aggregate Keywords</h1>
            <section className="machete-campaign-selector">
                <b>Select campaigns:</b>
                <CampaignSelector selectGroups={true} campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
            </section>
            <section>
                {display}
            </section>
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ dataPromise: this.props.loadDataPromise(selection) });
    }
}

AggregateKeywords.propTypes = {
    campaignPromise: PropTypes.object.isRequired,
    loadDataPromise: PropTypes.func.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
};

module.exports = AggregateKeywords;
