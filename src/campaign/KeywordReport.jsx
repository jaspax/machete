const React = require('react');
const PropTypes = require('prop-types');
const KeywordTable = require('./KeywordTable.jsx');

class KeywordReport extends React.Component {
    render() {
        return (
            <section>
                <h3>{this.props.title}</h3>
                <KeywordTable
                    data={this.props.data}
                    metric={this.props.formatter}
                    columnTitle={this.props.columnTitle} 
                    onKeywordEnabledChange={this.props.onKeywordEnabledChange}
                    onKeywordBidChange={this.props.onKeywordBidChange}
                />
            </section>
        );
    }

    componentWillReceiveProps() {
        console.log(this.constructor.name, "will receieve props");
    }
}

KeywordReport.propTypes = {
    data: PropTypes.array.isRequired,
    formatter: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    columnTitle: PropTypes.string.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordReport;
