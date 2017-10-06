const React = require('react');
const PropTypes = require('prop-types');
const Select = require('react-select');
const _ = require('lodash');

function CampaignSelector(props) {
    const campaigns = props.campaigns;
    let options = campaigns.map(c => ({ value: [c], label: c.name }));

    if (props.selectGroups) {
        // Add the 'All Campaigns' and others to the top
        options = [
            { value: campaigns, label: 'All Campaigns' },
            { value: campaigns.filter(c => c.status == 'RUNNING'), label: 'All Active Campaigns' }
        ].concat(...options);

        for (const asin of _.uniq(campaigns.map(c => c.asin))) {
            options.push({ value: campaigns.filter(c => c.asin == asin), label: 'ASIN: ' + asin });
        }
    }

    return <Select name="campaign-select" options={options} onChange={props.onChange} />;
}

CampaignSelector.propTypes = {
    selectGroups: PropTypes.bool,
    campaigns: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
};

CampaignSelector.defaultProps = { selectGroups: true };

module.exports = CampaignSelector;
