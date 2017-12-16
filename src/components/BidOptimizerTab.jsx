const React = require('react');
const PropTypes = require('prop-types');

const BidOptimizationChooser = require('./BidOptimizationChooser.jsx');

function BidOptimizerTab(props) {
    return <div className="a-box-inner">
        <BidOptimizationChooser
            targetSales={props.targetSales}
            targetAcos={props.targetAcos}
            optimizeAcos={props.optimizeAcos}
            optimizeSales={props.optimizeSales}
            updateKeyword={props.updateKeyword}
        />
    </div>;
}

BidOptimizerTab.propTypes = {
    targetAcos: PropTypes.number.isRequired,
    targetSales: PropTypes.number.isRequired,
    optimizeAcos: PropTypes.func.isRequired,
    optimizeSales: PropTypes.func.isRequired,
    updateKeyword: PropTypes.func.isRequired,
};

module.exports = BidOptimizerTab;
