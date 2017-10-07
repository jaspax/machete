const React = require('react');
const PropTypes = require('prop-types');
const Select = require('react-select');
const _ = require('lodash');

function CampaignSelector(props) {
    const campaigns = props.campaigns;
    let options = campaigns.map(c => ({ value: [c], label: 'Campaign: ' + c.name }));

    if (props.selectGroups) {
        // Add the 'All Campaigns' and others to the top
        options = [
            { value: campaigns, label: 'All Campaigns' },
            { value: campaigns.filter(c => c.status == 'RUNNING'), label: 'All Active Campaigns' }
        ].concat(...options);

        for (const asin of _.uniq(campaigns.map(c => c.asin))) {
            options.push({ value: campaigns.filter(c => c.asin == asin), label: 'Campaigns for ASIN: ' + asin });
        }
    }

    const onChange = selected => {
        let value = [];
        selected.forEach(s => value= value.concat(...s));
        props.onChange(value);
    };

    return <Select name="campaign-select" options={options} onChange={onChange} multi={true} />;
}

CampaignSelector.propTypes = {
    selectGroups: PropTypes.bool,
    campaigns: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
};

CampaignSelector.defaultProps = { selectGroups: true };

module.exports = CampaignSelector;
