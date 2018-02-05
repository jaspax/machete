const React = require('react');
const PropTypes = require('prop-types');
const _ = require('lodash');

const ErrorBoundary = require('./ErrorBoundary.jsx');
const CampaignSelector = require('./CampaignSelector.jsx');
const CampaignHistoryView = require('./CampaignHistoryView.jsx');

class AggregateHistory extends React.Component {
    constructor(props) {
        super(props);

        this.campaignSelectionChange = this.campaignSelectionChange.bind(this);
        this.metricSelectionChange = this.metricSelectionChange.bind(this);
        this.state = {
            campaignSelection: [],
            metricSelection: 'all',
        };
    }

    render() {
        let display = null;
        if (this.state.dataPromise) {
             display = <section className="machete-report">
                <h1>History</h1>
                <CampaignHistoryView dataPromise={this.state.dataPromise} showMetricFocus={true} />
            </section>;
        }

        return <div className="a-box-inner">
            <ErrorBoundary>
                <section className="machete-campaign-selector">
                    <h1>Aggregate Campaign History</h1>
                    <b>Select campaigns:</b>
                    <CampaignSelector campaignPromise={this.props.campaignPromise} onChange={this.campaignSelectionChange} />
                </section>
                {display}
            </ErrorBoundary>
        </div>;
    }

    campaignSelectionChange(selection) {
        this.setState({ 
            campaignSelection: selection,
            dataPromise: this.metricFocus(selection, this.state.metricSelection),
        });
    }

    metricSelectionChange(selection) {
        this.setState({ metricSelection: selection });
        if (this.state.dataPromise) {
            this.setState({ dataPromise: this.metricFocus(this.state.campaignSelection, selection) });
        }
    }

    metricFocus(campaigns, metric) {
        if (metric == 'all')
            return this.props.loadDataPromise(campaigns);
        return this.props.loadDataPromise(campaigns)
        .then(data => _.chain(data).groupBy(x => x.campaignId).filter(x => _.pick(x, [metric])).values().value());
    }
}

AggregateHistory.propTypes = {
    loadDataPromise: PropTypes.func.isRequired,
    campaignPromise: PropTypes.object.isRequired,
};

module.exports = AggregateHistory;
