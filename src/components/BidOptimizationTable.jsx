const React = require('react');
const PropTypes = require('prop-types');
const KeywordTable = require('./KeywordTable.jsx');

const common = require('../common/common.js');

function BidOptimizationTable(props) {
    const columns = [
        {
            title: 'Current Bid',
            metric: 'bid',
            format: common.moneyFmt,
        },
        {
            title: 'Suggested Bid',
            metric: 'optimizedBid',
            format: common.moneyFmt,
        },
        {
            title: 'Current CPC',
            metric: 'avgCpc',
            format: common.moneyFmt,
        },
        {
            title: 'Why not optimized?',
            metric: 'optimizeResult',
            format: x => {
                switch (x) {
                    case 'lowImpressions': return "Not enough impressions";
                    case 'lowClicks': return "Not enough clicks";
                    case 'lowSales': return "Not enough sales";
                    default: return '';
                }
            },
        }
    ];

    return <KeywordTable
        data={props.data} 
        columns={columns}
        showUpdateColumn={false}
    />;
}

BidOptimizationTable.propTypes = { data: PropTypes.array.isRequired, };

module.exports = BidOptimizationTable;
