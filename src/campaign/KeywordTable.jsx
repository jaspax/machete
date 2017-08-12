const React = require('react');
const PropTypes = require('prop-types');
const ReactTable = require('react-table').default;

class KeywordTable extends React.Component {
    render() {

        const columns = [
            { Header: 'Keyword', accessor: 'keyword' },
            { Header: this.props.title, accessor: this.props.metric, id: this.props.title },
            { Header: 'Update', Cell: 'placeholder' }
        ];

        return <ReactTable data={this.props.data} columns={columns} />;
    }
}

KeywordTable.propTypes = {
    data: PropTypes.array.isRequired,
    title: PropTypes.string.isRequired,
    metric: PropTypes.func.isRequired,
};

module.exports = KeywordTable;
