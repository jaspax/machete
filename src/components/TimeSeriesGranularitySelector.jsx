const React = require('react');
const PropTypes = require('prop-types');
const moment = require('moment');

const Select = require('react-select').default;

const options = [
    { label: 'Day', value: 0, chunk: 'day' },
    { label: 'Week', value: 1, chunk: 'week' },
    { label: 'Month', value: 2, chunk: 'month' },
];

class TimeSeriesGranularitySelector extends React.Component {
    render() {
        return <Select name="granularity-select"
            options={options}
            onChange={this.onChange.bind(this)}
            value={this.value()}
        />;
    }

    value() {
        const selected = options.find(x => x.chunk == this.props.value);
        return selected ? selected.value : 0;
    }

    onChange(value) {
        const selected = options.find(x => x.value == value);
        this.props.onChange(selected || options[0]);
    }
}

TimeSeriesGranularitySelector.options = options;
TimeSeriesGranularitySelector.propTypes = { 
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

module.exports = TimeSeriesGranularitySelector;
