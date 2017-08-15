const React = require('react');
const PropTypes = require('prop-types');
const KeywordTable = require('./KeywordTable.jsx');
const KeywordBulkUpdate = require('./KeywordBulkUpdate.jsx');

class KeywordReport extends React.Component {
    render() {
        return (
            <section>
                <h3>{this.props.title}</h3>
                <KeywordBulkUpdate
                    data={this.props.data}
                    onEnabledChange={this.props.onKeywordEnabledChange}
                    onBidChange={this.props.onKeywordBidChange}
                />
                <div style={{clear: 'both'}}>
                    <KeywordTable
                        data={this.props.data}
                        metric={this.props.metric}
                        formatter={this.props.formatter}
                        sort={this.props.sort}
                        columnTitle={this.props.columnTitle} 
                        onKeywordEnabledChange={singleKeywordChange(this.props.onKeywordEnabledChange)}
                        onKeywordBidChange={singleKeywordChange(this.props.onKeywordBidChange)}
                    />
                </div>
            </section>
        );
    }

    shouldComponentUpdate(nextProps) {
        if (!nextProps.modifiedData) {
            return true;
        }
        for (let item of nextProps.modifiedData) {
            if (this.props.data.includes(item) || nextProps.data.includes(item)) {
                return true;
            }
        }
        return false;
    }
}

function singleKeywordChange(callback) {
    return (value, item) => callback(value, [item]);
}

KeywordReport.propTypes = {
    data: PropTypes.array.isRequired,
    modifiedData: PropTypes.array,
    metric: PropTypes.func.isRequired,
    formatter: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    sort: PropTypes.string,
    columnTitle: PropTypes.string.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordReport;
