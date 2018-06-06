const React = require('react');
const PropTypes = require('prop-types');
const qu = require('async/queue');

const common = require('../common/common.js');

const Async = require('react-promise').default;
const BidOptimizationTargetPicker = require('./BidOptimizationTargetPicker.jsx');
const BidOptimizationOptions = require('./BidOptimizationOptions.jsx');
const BidOptimizationTable = require('./BidOptimizationTable.jsx');
const ErrorSink = require('./ErrorSink.jsx');

class BidOptimizationChooser extends React.Component {
    constructor(props) {
        super(props);
        const defaultTarget = { 
            target: props.defaultTarget,
            value: props.defaultTargetValue,
        };
        const defaultOptions = {
            useSimilarCampaigns: true,
            excludeLowImpressions: true,
            minImpressions: 1000,
        };
        this.state = {
            keywordPromise: this.keywordPromise(defaultTarget, defaultOptions),
            options: defaultOptions,
            target: props.defaultTarget,
            targetValue: props.defaultTargetValue,
            lastKeywords: [],
        };
    }

    render() {
        return <div>
            <div className="machete-2col">
                <BidOptimizationTargetPicker className="machete-2col" target={this.state.target} targetValue={this.state.targetValue.toString()} onChange={this.targetChanged.bind(this)} />
                <BidOptimizationOptions options={this.state.options} onChange={this.optionsChanged.bind(this)} />
            </div>
            <Async promise={this.state.keywordPromise} pending={this.pendingTable()} then={this.tableReady.bind(this)} catch={this.tableCatch.bind(this)} />
        </div>;
    }

    keywordPromise(target, options) {
        this.setState({ message: "Analyzing keywords..." });
        return this.props.keywordPromiseFactory(target, options).then(kws => {
            this.setState({ lastKeywords: kws });
            return Promise.resolve(kws);
        });
    }

    pendingTable() {
        return <div>
            <button className="machete-button" onClick={this.calcOptimizations.bind(this)}>Calculate optimizations</button>
            <div className="loading-small" style={{ display: 'inline-block', marginRight: '10px', marginLeft: '10px' }} >&nbsp;</div>{this.state.message}
            <BidOptimizationTable data={this.state.lastKeywords} />
        </div>;
    }

    tableReady(kws) {
        return <div>
            <button className="machete-button" onClick={this.calcOptimizations.bind(this)}>Calculate optimizations</button>
            <button className="machete-highlight-button" onClick={this.applyOptimizations.bind(this)}>Apply all optimizations</button>
            <BidOptimizationTable data={kws} />
        </div>;
    }

    tableCatch(err) {
        return <div>
            <button className="machete-button" onClick={this.calcOptimizations.bind(this)}>Calculate optimizations</button>
            <ErrorSink error={err} />
        </div>;
    }

    targetChanged(opts) {
        this.setState(opts);
    }

    optionsChanged(opts) {
        const state = this.state;
        state.options = opts;
        this.setState(state);
    }

    calcOptimizations(evt) {
        evt.preventDefault();
        const value = Number(this.state.targetValue);
        if (value && !isNaN(value) && value > 0) {
            const options = this.state.options;
            if (options.excludeLowImpressions)
                options.minImpressions = 1000;
            else
                options.minImpressions = 0;
            this.setState({ keywordPromise: this.keywordPromise({ target: this.state.target, value }, options) });
        }
        else {
            this.setState({ keywordPromise: Promise.reject(new Error('Please enter a value greater than 0')) });
        }
        return false;
    }

    applyOptimizations() {
        if (!this.state.lastKeywords)
            console.log('trying to apply optimizations with lastKeywords=null?');

        const kwq = qu((kw, callback) => {
            this.setState({ 
                keywordPromise: new Promise(() => {}), // eslint-disable-line no-empty-function
                message: `Change bid on "${kw.keyword}" to ${common.moneyFmt(kw.optimizedBid)}`
            });
            this.props.updateKeyword(kw).then(callback, callback);
        }, 3);
        kwq.drain = () => this.setState({ keywordPromise: Promise.resolve(this.state.lastKeywords) });

        kwq.push(this.state.lastKeywords.filter(kw => kw.optimizeResult == 'optimized'));
    }
}

BidOptimizationChooser.propTypes = {
    defaultTarget: PropTypes.string.isRequired,
    defaultTargetValue: PropTypes.number.isRequired,
    keywordPromiseFactory: PropTypes.func.isRequired,
    updateKeyword: PropTypes.func.isRequired,
};

module.exports = BidOptimizationChooser;
