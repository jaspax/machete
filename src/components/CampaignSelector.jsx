const React = require('react');
const PropTypes = require('prop-types');
const Select = require('react-select').default;
const DataNotAvailable = require('./DataNotAvailable.jsx');
const _ = require('lodash');

class CampaignSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.onChange = this.onChange.bind(this);
    }

    onChange(value) {
        let selected = [];
        value.forEach(x => selected = selected.concat(...this.state.rawOptions[x.value].value));
        selected = _.uniq(selected, x => x.campaignId);
        this.props.onChange(selected);
        this.setState({ value });
    }

    render() {
        if (this.state.options) {
            return <Select name="campaign-select" 
                options={this.state.options} 
                onChange={this.onChange} 
                multi={true} 
                value={this.state.value} />;
        }
        if (this.state.error) {
            const error = this.state.error;
            if (this.state.error.handled) {
                return <DataNotAvailable allowed={!error.notAllowed} anonymous={error.notLoggedIn} />;
            }
        }

        this.props.campaignPromise
        .then(campaigns => {
            let rawOptions = campaigns.map(c => ({ value: [c], label: 'Campaign: ' + c.name }));

            if (this.props.selectGroups) {
                // Add the 'All Campaigns' and others to the top
                rawOptions = [
                    { value: campaigns, label: 'All Campaigns' },
                    { value: campaigns.filter(c => c.status == 'RUNNING'), label: 'All Active Campaigns' }
                ].concat(...rawOptions);

                for (const asin of _.uniq(campaigns.map(c => c.asin).filter(a => a))) {
                    rawOptions.push({ value: campaigns.filter(c => c.asin == asin), label: 'Campaigns for ASIN: ' + asin });
                }
            }

            // The actual value that we put into the selector has to be an
            // integer, so we make a second array that just has the indexes into
            // the rawOptions array
            this.setState({ 
                rawOptions,
                options: rawOptions.map((x, index) => ({ value: index, label: x.label }))
            });
        })
        .catch(error => this.setState({ error }));

        return <Select name="campaign-select" isLoading={true} />;
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.campaignPromise != this.props.campaignPromise)
            this.setState({});
    }
}

CampaignSelector.propTypes = {
    campaignPromise: PropTypes.object.isRequired,
    selectGroups: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
};

CampaignSelector.defaultProps = { selectGroups: true };

module.exports = CampaignSelector;
