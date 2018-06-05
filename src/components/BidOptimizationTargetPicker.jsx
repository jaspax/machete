const React = require('react');
const PropTypes = require('prop-types');
const { RadioGroup, Radio } = require('react-radio-group');

function BidOptimizationTargetPicker(props) {
    let preMarker = null;
    let postMarker = null;
    if (props.target == 'acos') {
        preMarker = '';
        postMarker = '%';
    }
    else if (props.target == 'sales') {
        preMarker = '$';
        postMarker = '';
    }

    const targetChanged = value => props.onChange({ target: value, targetValue: props.targetValue });
    const targetValueChanged = evt => props.onChange({ target: props.target, targetValue: evt.target.value });

    return <div className="machete-optimization-chooser">
        <div className="machete-radio-group-label">Optimize for:</div>
        <RadioGroup className="machete-radio-horizontal" name="metricSelection" selectedValue={props.target} onChange={targetChanged}>
            <Radio id="machete-optimize-acos" value="acos" /><label htmlFor="machete-optimize-acos">ACOS</label>
            <Radio id="machete-optimize-sales" value="sales" /><label htmlFor="machete-optimize-sales">Sales per day</label>
        </RadioGroup>
        <div>
            {preMarker}<input size="7" type="text" name="machete-target-value" onChange={targetValueChanged} defaultValue={props.targetValue} />{postMarker}&nbsp;
        </div>
    </div>;
}

BidOptimizationTargetPicker.propTypes = {
    target: PropTypes.string.isRequired,
    targetValue: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};

module.exports = BidOptimizationTargetPicker;
