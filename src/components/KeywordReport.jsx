const React = require('react');
const PropTypes = require('prop-types');
const KeywordTable = require('./KeywordTable.jsx');
const KeywordBulkUpdate = require('./KeywordBulkUpdate.jsx');
const Collapsible = require('react-collapsible').default;

const ga = require('../common/ga.js');

class KeywordReport extends React.Component {
    render() {
        return <Collapsible trigger={this.props.title} lazyRender={true} transitionTime={200}>
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
        </Collapsible>;
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
    return ga.mcatch((value, item) => handler(value, [item]));
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
