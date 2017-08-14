const React = require('react');
const PropTypes = require('prop-types');
const ReactTable = require('react-table').default;

const KeywordEnableToggle = require('./KeywordEnableToggle.jsx');
const KeywordBidUpdate = require('./KeywordBidUpdate.jsx');

class KeywordTable extends React.Component {
    render() {

        const columns = [
            { 
                Header: 'Keyword', 
                accessor: 'keyword' 
            },
            { 
                Header: this.props.columnTitle, 
                accessor: this.props.metric, 
                id: this.props.columnTitle
            },
            { 
                Header: 'Update', 
                Cell: row =>
                    <div>
                        <KeywordEnableToggle enabled={row.original.enabled} onChange={bindKeywordChange(row.original, this.props.onKeywordEnabledChange)} />
                        <KeywordBidUpdate bid={parseFloat(row.original.bid)} onChange={bindKeywordChange(row.original, this.props.onKeywordBidChange)} />
                    </div>,
            }
        ];

        return <ReactTable data={this.props.data} columns={columns} />;
    }

    componentWillReceiveProps() {
        console.log(this.constructor.name, "will receieve props");
    }
}

function bindKeywordChange(item, callback) {
    return (value) => callback(value, item);
}

KeywordTable.propTypes = {
    data: PropTypes.array.isRequired,
    columnTitle: PropTypes.string.isRequired,
    metric: PropTypes.func.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordTable;
