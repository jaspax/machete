const React = require('react');
const PropTypes = require('prop-types');
const qu = require('async/queue');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

class BidOptimizationChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = { loading: false, error: false, message: '' };
        this.clickOptimizeAcos = ga.mcatch(this.clickOptimizeAcos.bind(this));
        this.clickOptimizeSales = ga.mcatch(this.clickOptimizeSales.bind(this));
    }

    render() {
        const btnDisabled = this.state.loading || this.state.error;

        return <div className="machete-optimization-chooser">
            <form name="optimizeOptions">
                <section className="machete-optimize-choice">
                    <h2>Target ACOS</h2>
                    <input type="text" name="targetAcos" defaultValue={common.numberFmt(this.props.targetAcos)} />%&nbsp;
                    <button onClick={this.clickOptimizeAcos} disabled={btnDisabled}>Optimize ACOS</button>
                    <p>Analyze your current ACOS and adjust bids to bring each keyword as close to the target ACOS as possible.</p>
                </section>
                <section className="machete-optimize-choice">
                    <h2>Target Sales</h2>
                    $<input type="text" name="targetSales" defaultValue={common.numberFmt(this.props.targetSales)} />&nbsp;
                    <button onClick={this.clickOptimizeSales} disabled={btnDisabled}>Optimize Sales</button>
                    <p>Analyze your historical sales and adjust bids to attempt to hit the target sales per day.</p>
                </section>
            </form>
            <div>
                <div style={{ display: 'inline-block' }} className={this.state.loading ? 'loading-small' : ''}>&nbsp;</div>
                <span className={this.state.error ? 'machete-error' : ''}>
                    {this.state.message}
                </span>
            </div>
        </div>;
    }

    clickOptimizeAcos(evt) {
        const form = document.forms.optimizeOptions;
        return this.optimize(evt, form.targetAcos.value, this.props.optimizeAcos);
    }

    clickOptimizeSales(evt) {
        const form = document.forms.optimizeOptions;
        return this.optimize(evt, form.targetSales.value, this.props.optimizeSales);
    }

    optimize(evt, value, callback) {
        evt.preventDefault();
        value = Number(value);
        if (value && !isNaN(value) && value > 0) {
            this.setState({ loading: true, error: false, message: "Analyzing keywords..." });
            callback(value).then(this.updateKeywords.bind(this), err => this.setState({ loading: false, error: true, message: err }));
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
