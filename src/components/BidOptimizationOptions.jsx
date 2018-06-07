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
        <div className="machete-2col">
            <label htmlFor="minBid">
                Minimum bid<br />
                <input id="minBid" type="text" size="7" className="machete-checkbox" onChange={inputChanged('minBid')} defaultValue={props.options.minBid} />
            </label>

            <label htmlFor="maxBid">
                Maximum bid<br />
                <input id="maxBid" type="text" size="7" className="machete-checkbox" onChange={inputChanged('maxBid')} defaultValue={props.options.maxBid} />
            </label>
        </div>

        <label htmlFor="excludeLowImpressions">
            <input id="excludeLowImpressions" type="checkbox" className="machete-checkbox" onChange={checkboxChanged('excludeLowImpressions')} defaultChecked={props.options.excludeLowImpressions} />
            Ignore keywords with few impressions
        </label>
    </div>;
}

BidOptimizationOptions.propTypes = {
    options: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = BidOptimizationOptions;
