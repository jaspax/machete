const React = require('react');
const PropTypes = require('prop-types');

const Select = require('react-select').default;

const options = [
    { label: 'Day', value: 0, chunk: 'day' },
    { label: 'Week', value: 1, chunk: 'week' },
    { label: 'Month', value: 2, chunk: 'month' },
];

function TimeSeriesGranularitySelector(props) {
    const selected = options.find(x => x.chunk == props.value);
    const value = selected ? selected.value : 0;
    return <Select name="granularity-select"
        options={options}
        onChange={(selected) => props.onChange(selected.chunk)}
        value={value}
    />;
}

TimeSeriesGranularitySelector.options = options;
TimeSeriesGranularitySelector.propTypes = { 
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = TimeSeriesGranularitySelector;
