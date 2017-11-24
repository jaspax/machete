const React = require('react');
const PropTypes = require('prop-types');

const common = require('../common/common.js');

function BidOptimizationChooser(props) {
    function btnClick(evt) {
        evt.preventDefault();

        const form = document.forms.optimizeOptions;
        const target = form.optimizeTarget.value;
        let value = null;
        if (target == 'acos') {
            value = Number(form.targetAcos.value);
        }
        if (target == 'sales') {
            value = Number(form.targetSales.value);
        }

        props.onChanged({ target, value });
        return false;
    }

    return <div className="machete-optimization-chooser">
        <form name="optimizeOptions">
            <div className="machete-optimize-choice">
                <input type="radio" name="optimizeTarget" value="acos" />&nbsp;Target ACOS:
                <input type="text" name="targetAcos" defaultValue={common.numberFmt(props.targetAcos)} />%
            </div>
            <div className="machete-optimize-choice">
                <input type="radio" name="optimizeTarget" value="sales" />&nbsp;Target Sales/day:
                $<input type="text" name="targetSales" defaultValue={common.numberFmt(props.targetSales)} />
            </div>
            <button onClick={btnClick}>Optimize</button>
        </form>
    </div>;
}

BidOptimizationChooser.propTypes = {
    targetAcos: PropTypes.number.isRequired,
    targetSales: PropTypes.number.isRequired,
    onChanged: PropTypes.func.isRequired,
};

module.exports = BidOptimizationChooser;
