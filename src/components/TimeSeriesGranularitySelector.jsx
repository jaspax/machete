const React = require('react');
const PropTypes = require('prop-types');

const Select = require('react-select').default;

const options = [
    { label: 'Daily', value: 0, chunk: 'day' },
    { label: 'Weekly', value: 1, chunk: 'week' },
    { label: 'Monthly', value: 2, chunk: 'month' },
];

function TimeSeriesGranularitySelector(props) {
    const selected = options.find(x => x.chunk == props.value);
    const value = selected ? selected.value : 0;
    return <div className="machete-granularity-select-wrapper">
        <b>Display statistics:&nbsp;</b>
        <Select name="granularity-select" className="machete-granularity-select"
            options={options}
            onChange={(selected) => props.onChange(selected.chunk)}
            value={value} />
    </div>;
}

TimeSeriesGranularitySelector.options = options;
TimeSeriesGranularitySelector.propTypes = { 
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = TimeSeriesGranularitySelector;
