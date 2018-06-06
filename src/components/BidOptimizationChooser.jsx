const React = require('react');
const PropTypes = require('prop-types');
const qu = require('async/queue');

const common = require('../common/common.js');

const Async = require('react-promise').default;
const BidOptimizationTargetPicker = require('./BidOptimizationTargetPicker.jsx');
const BidOptimizationTable = require('./BidOptimizationTable.jsx');
const ErrorSink = require('./ErrorSink.jsx');

class BidOptimizationChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            keywordPromise: this.keywordPromise({ 
                target: props.defaultTarget,
                value: props.defaultTargetValue,
            }),
            target: props.defaultTarget,
            targetValue: props.defaultTargetValue,
            lastKeywords: [],
        };
    }

    render() {
        return <div>
            <BidOptimizationTargetPicker target={this.state.target} targetValue={this.state.targetValue.toString()} onChange={this.targetChanged.bind(this)} />
            <button className="machete-button" onClick={this.calcOptimizations.bind(this)}>Calculate optimizations</button>
            <Async promise={this.state.keywordPromise} pending={this.pendingTable()} then={this.tableReady.bind(this)} catch={this.tableCatch.bind(this)} />
        </div>;
    }

    keywordPromise(opts) {
        return this.props.keywordPromiseFactory(opts).then(kws => {
            this.setState({ lastKeywords: kws });
            return Promise.resolve(kws);
        });
    }

    pendingTable() {
        return <div>
            <div className="loading-small" style={{ display: 'inline-block', marginRight: '10px' }} >&nbsp;</div> Analyzing keywords...
            <BidOptimizationTable data={this.state.lastKeywords} />
        </div>;
    }

    tableReady(kws) {
        return <div>
            <button className="machete-highlight-button" onClick={this.applyOptimizations.bind(this)}>Apply all</button>
            <BidOptimizationTable data={kws} />
        </div>;
    }

    tableCatch(err) {
        return <div>
            <ErrorSink error={err} />
            <BidOptimizationTable data={this.state.lastKeywords} />
        </div>;
    }

    targetChanged(opts) {
        const state = this.state;
        Object.assign(state, opts);
        this.setState(state);
    }

    calcOptimizations(evt) {
        evt.preventDefault();
        const value = Number(this.state.targetValue);
        if (value && !isNaN(value) && value > 0) {
            this.setState({ keywordPromise: this.props.keywordPromiseFactory({ target: this.state.target, value }) });
        }
        else {
            this.setState({ keywordPromise: Promise.reject(new Error('Please enter a value greater than 0')) });
        }
        return false;
    }

    applyOptimizations() {
        const self = this;
        const kwq = qu((kw, callback) => {
            self.setState({ 
                loading: true, 
                message: `Change bid on "${kw.keyword}" to ${common.moneyFmt(kw.bid)}`
            });
            self.props.updateKeyword(kw).then(callback, callback);
        }, 6);

        kwq.drain = () => self.setState({
            loading: false,
            message: "Done."
        });

        kwq.push(this.state.optimizedKws);
    }
}

BidOptimizationChooser.propTypes = {
    defaultTarget: PropTypes.string.isRequired,
    defaultTargetValue: PropTypes.number.isRequired,
    keywordPromiseFactory: PropTypes.func.isRequired,
    updateKeyword: PropTypes.func.isRequired,
};

module.exports = BidOptimizationChooser;
