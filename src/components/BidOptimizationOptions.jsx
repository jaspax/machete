const React = require('react');
const PropTypes = require('prop-types');

function BidOptimizationOptions(props) {
    function checkboxChanged(checkboxId) {
        return () => {
            props.options[checkboxId] = !props.options[checkboxId];
            props.onChange(props.options);
        };
    }
    function inputChanged(inputId) {
        return evt => {
            props.options[inputId] = Number(evt.target.value);
            props.onChange(props.options);
        };
    }

    return <div>
        <label htmlFor="useSimilarCampaigns">
            <input id="useSimilarCampaigns" type="checkbox" onChange={checkboxChanged('useSimilarCampaigns')} defaultChecked={props.options.useSimilarCampaigns} />
            Include keyword data from similar campaigns for analysis
        </label>

        <label htmlFor="excludeLowImpressions">
            <input id="excludeLowImpressions" type="checkbox" onChange={checkboxChanged('excludeLowImpressions')} defaultChecked={props.options.excludeLowImpressions} />
            Ignore keywords with few impressions
        </label>

        <label htmlFor="minBid">
            Minimum bid<br />
            <input id="minBid" type="text" onChange={inputChanged('minBid')} defaultValue={props.options.minBid} />
        </label>

        <label htmlFor="maxBid">
            Maximum bid<br />
            <input id="maxBid" type="text" onChange={inputChanged('maxBid')} defaultValue={props.options.maxBid} />
        </label>
    </div>;
}

BidOptimizationOptions.propTypes = {
    options: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = BidOptimizationOptions;
