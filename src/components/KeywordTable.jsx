const React = require('react');
const PropTypes = require('prop-types');
const ReactTable = require('react-table').default;
require('react-table/react-table.css');

const ga = require('../common/ga.js');

const KeywordEnableToggle = require('./KeywordEnableToggle.jsx');
const KeywordBidUpdate = require('./KeywordBidUpdate.jsx');

class KeywordTable extends React.Component {
    render() {
        const columns = [{
            Header: 'Keyword', 
            accessor: 'keyword' 
        }];

        for (const col of this.props.columns) {
            const format = col.format || (x => x);
            columns.push({
                Header: col.title,
                Cell: row => <span>{format(row.value)}</span>,
                accessor: col.metric,
                id: col.title.toLowerCase()
            });
        }

        columns.push({
            Header: 'Update', 
            Cell: row =>
                <div>
                    <KeywordEnableToggle enabled={row.original.enabled} onChange={bindKeywordChange(row.original, this.props.onKeywordEnabledChange)} />
                    <KeywordBidUpdate bid={parseFloat(row.original.bid)} onChange={bindKeywordChange(row.original, this.props.onKeywordBidChange)} />
                </div>,
            minWidth: 190,
        });

        const sortColumn = this.props.columns.filter(col => col.sort).map(col => ({
            id: col.title.toLowerCase(),
            desc: col.sort == 'desc',
        }));

        return <ReactTable 
            data={this.props.data} 
            columns={columns} 
            defaultSorted={sortColumn}
            defaultPageSize={10}
            minRows={0}
        />;
    }
}

function bindKeywordChange(item, callback) {
    return ga.mcatch((value) => callback(value, item));
}

KeywordTable.propTypes = {
    data: PropTypes.array.isRequired,
    columns: PropTypes.array.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordTable;
