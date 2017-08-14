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
                    metric={this.props.metric}
                    formatter={this.props.formatter}
                    sort={this.props.sort}
                    columnTitle={this.props.columnTitle} 
                    onKeywordEnabledChange={this.props.onKeywordEnabledChange}
                    onKeywordBidChange={this.props.onKeywordBidChange}
                />
            </section>
        );
    }
}

KeywordReport.propTypes = {
    data: PropTypes.array.isRequired,
    metric: PropTypes.func.isRequired,
    formatter: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    sort: PropTypes.string,
    columnTitle: PropTypes.string.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordReport;
