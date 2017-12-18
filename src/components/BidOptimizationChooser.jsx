const React = require('react');
const PropTypes = require('prop-types');
const co = require('co');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

class BidOptimizationChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = { loading: false, message: '' };
        this.clickOptimizeAcos = ga.mcatch(this.clickOptimizeAcos.bind(this));
        this.clickOptimizeSales = ga.mcatch(this.clickOptimizeSales.bind(this));
    }

    render() {
        return <div className="machete-optimization-chooser">
            <form name="optimizeOptions">
                <div className="machete-optimize-choice">
                    Target ACOS:&nbsp;
                    <input type="text" name="targetAcos" defaultValue={common.numberFmt(this.props.targetAcos)} />%&nbsp;
                    <button onClick={this.clickOptimizeAcos}>Optimize ACOS</button>
                </div>
                <div className="machete-optimize-choice">
                    Target Sales/day:&nbsp;
                    $<input type="text" name="targetSales" defaultValue={common.numberFmt(this.props.targetSales)} />&nbsp;
                    <button onClick={this.clickOptimizeSales}>Optimize Sales</button>
                </div>
            </form>
            <div>
                <span className={this.state.loading ? 'loading-small' : ''}>&nbsp;&nbsp;&nbsp;&nbsp;</span>
                {this.state.message}
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
        this.setState({ loading: true, message: "Analyzing keywords..." });
        callback(Number(value)).then(this.updateKeywords.bind(this));
        return false;
    }

    updateKeywords(kws) {
        const self = this;
        co(function*() {
            for (const kw of kws) {
                self.setState({ 
                    loading: true, 
                    message: `Change bid on "${kw.keyword}" to ${common.moneyFmt(kw.bid)}`
                });
                yield self.props.updateKeyword(kw);
            }
            self.setState({
                loading: false,
                message: "Done."
            });
        });
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
