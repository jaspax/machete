const React = require('react');
const PropTypes = require('prop-types');

const BidOptimizationChooser = require('./BidOptimizationChooser.jsx');

function BidOptimizerTab(props) {
    function onChange(opts) {
        if (opts.target == 'acos') {
            props.optimizeAcos(opts.value);
        }
        if (opts.target == 'sales') {
            props.optimizeSales(opts.value);
        }
    }

    return <div className="a-box-inner">
        <BidOptimizationChooser 
            targetSales={props.targetSales} 
            targetAcos={props.targetAcos} 
            onChanged={onChange}
        />
    </div>;
}

BidOptimizerTab.propTypes = {
    targetAcos: PropTypes.number.isRequired,
    targetSales: PropTypes.number.isRequired,
    optimizeAcos: PropTypes.func.isRequired,
    optimizeSales: PropTypes.func.isRequired, 
};

module.exports = BidOptimizerTab;
