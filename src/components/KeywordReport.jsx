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
                        columns={this.props.columns}
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

function singleKeywordChange(handler) {
    return (value, item) => handler(value, [item]);
}

KeywordReport.propTypes = {
    title: PropTypes.string.isRequired,
    data: PropTypes.array.isRequired,
    modifiedData: PropTypes.array,
    columns: PropTypes.array.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordReport;
