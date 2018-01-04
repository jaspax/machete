const React = require('react');
const PropTypes = require('prop-types');

const { RadioGroup, Radio } = require('react-radio-group');

function TimeSeriesGranularitySelector(props) {
    return <div className="machete-radio-group-wrapper">
        <div className="machete-radio-group-label">Display statistics:</div>
        <RadioGroup className="machete-radio-horizontal" id="machete-granularity-selector" selectedValue={props.value} onChange={props.onChange}>
            <Radio id="machete-granularity-selector-daily" value="day" /><label htmlFor="machete-granularity-selector-daily">Daily</label>
            <Radio id="machete-granularity-selector-weekly" value="week" /><label htmlFor="machete-granularity-selector-weekly">Weekly</label>
            <Radio id="machete-granularity-selector-monthly" value="month" /><label htmlFor="machete-granularity-selector-monthly">Monthly</label>
        </RadioGroup>
    </div>;
}

TimeSeriesGranularitySelector.propTypes = { 
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = TimeSeriesGranularitySelector;
