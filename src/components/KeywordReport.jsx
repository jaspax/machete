const React = require('react');
const PropTypes = require('prop-types');
const ErrorBoundary = require('./ErrorBoundary.jsx');
const KeywordTable = require('./KeywordTable.jsx');
const KeywordBulkUpdate = require('./KeywordBulkUpdate.jsx');
const Collapsible = require('react-collapsible').default;

const ga = require('../common/ga.js');

class KeywordReport extends React.Component {
    render() {
        return <Collapsible trigger={this.props.title} lazyRender={true} onOpen={this.onOpen.bind(this)} transitionTime={200}>
            <ErrorBoundary>
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
            </ErrorBoundary>
        </Collapsible>;
    }

    onOpen() {
        ga.revent('kwReportOpen', { title: this.props.title });
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
