const React = require('react');
const PropTypes = require('prop-types');
const qu = require('async/queue');

const common = require('../common/common.js');

const BidOptimizationTargetPicker = require('./BidOptimizationTargetPicker.jsx');
const BidOptimizationTable = require('./BidOptimizationTable.jsx');

class BidOptimizationChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            error: false,
            message: '',
            target: 'acos',
            targetValue: 70,
            optimizedKws: [],
        };
    }

    render() {
        return <div>
            <BidOptimizationTargetPicker target={this.state.target} targetValue={this.state.targetValue} onChange={this.targetChanged.bind(this)} />
            <button className="machete-highlight-button" onClick={this.optimize.bind(this)}>Optimize</button>
            <div>
                <div style={{ display: 'inline-block', marginRight: '10px' }} className={this.state.loading ? 'loading-small' : ''}>&nbsp;</div>
                <span className={this.state.error ? 'machete-error' : ''}>
                    {this.state.message}
                </span>
            </div>
            <BidOptimizationTable data={this.state.optimizedKws} />
        </div>;
    }

    targetChanged(opts) {
        const state = this.state;
        state.target = opts.target;
        state.targetValue = opts.targetValue;
        this.setState(state);
    }

    optimize(evt) {
        evt.preventDefault();
        const value = Number(this.state.targetValue);
        const optimizer = this.state.target == 'acos' ? this.props.optimizeAcos : this.props.optimizeSales;
        if (value && !isNaN(value) && value > 0) {
            this.setState({ loading: true, error: false, message: "Analyzing keywords..." });
            optimizer(value).then(kws => this.setState({ optimizedKws: kws }));
        }
        else {
            this.setState({ error: true, message: "Please enter a value greater than 0" });
        }
        return false;
    }

    updateKeywords(kws) {
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

        kwq.push(kws);
    }
}

BidOptimizationChooser.propTypes = {
    targetAcos: PropTypes.number.isRequired,
    targetSales: PropTypes.number.isRequired,
    optimizeAcos: PropTypes.func.isRequired,
    optimizeSales: PropTypes.func.isRequired,
    updateKeyword: PropTypes.func.isRequired,
};

module.exports = BidOptimizationChooser;
