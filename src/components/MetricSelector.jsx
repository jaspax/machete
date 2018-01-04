const React = require('react');
const PropTypes = require('prop-types');

const { RadioGroup, Radio } = require('react-radio-group');

function MetricSelector(props) {
    return <div className="machete-radio-group-wrapper">
        <div className="machete-radio-group-label">Focus metric:</div>
        <RadioGroup className="machete-radio-horizontal" name="metricSelection" selectedValue={props.selected} onChange={props.onChange}>
            <Radio id="metric-selector-all" value="all" /><label htmlFor="metric-selector-all">All</label>
            <Radio id="metric-selector-impressions" value="impressions" /><label htmlFor="metric-selector-impressions">Impressions</label>
            <Radio id="metric-selector-clicks" value="clicks" /><label htmlFor="metric-selector-clicks">Clicks</label>
            <Radio id="metric-selector-sales" value="salesValue" /><label htmlFor="metric-selector-sales">Sales</label>
            <Radio id="metric-selector-spend" value="spend" /><label htmlFor="metric-selector-spend">Spend</label>
        </RadioGroup>
    </div>;
}

MetricSelector.propTypes = {
    selected: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};

module.exports = MetricSelector;
