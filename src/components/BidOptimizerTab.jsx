const React = require('react');
const PropTypes = require('prop-types');

const BidOptimizationChooser = require('./BidOptimizationChooser.jsx');

function BidOptimizerTab(props) {
    return <div className="a-box-inner">
        <h1>Bid Optimizer</h1>

        <p>Machete&rsquo;s bid optimizer will analyze keyword performance for
            this campaign and other campaigns for the same product. It will then
            set the bid for each keyword individually in order to maximise its
            performance.</p>

        <p className="machete-warning">We recommend that you only do this for
            campaigns which have already been running for at least 30 days, or
            which advertise products that you have previously advertised for at
            least 30 days.</p>

        <p>This tool <b>only</b> modifies bids. It does not do any of the following</p>
        <ul>
            <li>Does not disable keywords</li>
            <li>Does not add new keywords</li>
            <li>Does not change your campaign&rsquo;s budget</li>
        </ul>

        <p>We recommend that you monitor your optimized campaigns and make
            manually adjustments as necessary. You may want to re-optimize
            periodically as new data comes in.</p>

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
