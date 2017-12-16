const React = require('react');
const PropTypes = require('prop-types');

const common = require('../common/common.js');

class BidOptimizationChooser extends React.Component(props) {
    constructor(props) {
        super(props);
        this.state = { loading: false, message: '' };
    }

    render() {
        return <div className="machete-optimization-chooser">
            <form name="optimizeOptions">
                <div className="machete-optimize-choice">
                    <input type="radio" name="optimizeTarget" value="acos" />&nbsp;Target ACOS:
                    <input type="text" name="targetAcos" defaultValue={common.numberFmt(this.props.targetAcos)} />%&nbsp;
                    <button onClick={this.clickOptimizeAcos.bind(this)}>Optimize ACOS</button>
                </div>
                <div className="machete-optimize-choice">
                    <input type="radio" name="optimizeTarget" value="sales" />&nbsp;Target Sales/day:
                    $<input type="text" name="targetSales" defaultValue={common.numberFmt(this.props.targetSales)} />&nbsp;
                    <button onClick={this.clickOptimizeSales.bind(this)}>Optimize Sales</button>
                </div>
            </form>
            <StatusMessage loading={this.state.loading} message={this.state.message} />
        </div>;
    }

    clickOptimizeAcos(evt) {
        const form = document.forms.optimizeOptions;
        return optimize(evt, form.targetAcos.value, this.props.optimizeAcos);
    }

    clickOptimizeSales(evt) {
        const form = document.forms.optimizeOptions;
        return optimize(evt, form.targetSales.value, this.props.optimizeSales);
    }

    optimize(evt, value, callback) {
        evt.preventDefault();
        this.setStatu({ loading: true, message: "Analyzing keywords..." });
        value = Number(form.targetSales.value);
        callback(value).then(this.updateKeywords.bind(this));
        return false;
    }

    updateKeywordList(kws) {
        co(function*() {
            for (const kw of kws) {
                this.setState({ 
                    loading: true, 
                    message: `Change bid on "${kw.keyword}" to ${common.moneyFmt(kw.bid)}`
                });
                yield this.props.updateKeyword(kw);
            }
            this.setState({
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
