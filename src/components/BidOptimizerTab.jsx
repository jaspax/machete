const React = require('react');
const PropTypes = require('prop-types');

const BidOptimizationChooser = require('./BidOptimizationChooser.jsx');
const ErrorBoundary = require('./ErrorBoundary.jsx');

function BidOptimizerTab(props) {
    return <div className="a-box-inner">
        <h1>Bid Optimizer</h1>

        <section>
            <p>Machete&rsquo;s bid optimizer will analyze keyword performance
                for this campaign and suggest an optimum bid for each keyword.
                Click <b>Apply all optimizations</b> to update all bids to their
                recommended value.</p>
        </section>

        <ErrorBoundary>
            <BidOptimizationChooser
                defaultTarget={props.defaultTarget}
                defaultTargetValue={props.defaultTargetValue}
                keywordPromiseFactory={props.keywordPromiseFactory}
                updateKeyword={props.updateKeyword}
            />
        </ErrorBoundary>
    </div>;
}

BidOptimizerTab.propTypes = {
    defaultTarget: PropTypes.string.isRequired,
    defaultTargetValue: PropTypes.number.isRequired,
    keywordPromiseFactory: PropTypes.func.isRequired,
    updateKeyword: PropTypes.func.isRequired,
};

module.exports = BidOptimizerTab;
