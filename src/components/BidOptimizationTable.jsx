const React = require('react');
const PropTypes = require('prop-types');
const KeywordTable = require('./KeywordTable.jsx');
const SmallButton = require('./SmallButton.jsx');

const common = require('../common/common.js');

function BidOptimizationTable(props) {
    const columns = [
        {
            title: 'Bid',
            metric: 'bid',
            format: common.moneyFmt,
        },
        {
            title: 'ACOS',
            metric: 'acos',
            format: common.pctFmt,
        },
        {
            title: 'CPC',
            metric: 'avgCpc',
            format: common.moneyFmt,
        },
        {
            title: 'Suggested Bid',
            format: (val, kw) => { // eslint-disable-line react/display-name
                const bidFmt = common.moneyFmt(kw.bid);
                const optFmt = common.moneyFmt(kw.optimizedBid);
                if (bidFmt == optFmt) {
                    return <span><span style={{ color: 'green', fontWeight: 'bold' }}>✓</span>&nbsp;Optimized</span>;
                }
                if (kw.optimizeResult == 'optimized') {
                    return <span>{optFmt}&nbsp;<SmallButton text="Apply" onClick={() => props.applyOptimization(kw)} /></span>;
                }
                return <span style={{ fontSize: 'smaller', color: 'gray' }}>Not enough data</span>;
            }
        }
    ];

    return <KeywordTable
        data={props.data} 
        columns={columns}
        showUpdateColumn={false}
    />;
}

BidOptimizationTable.propTypes = { 
    data: PropTypes.array.isRequired, 
    applyOptimization: PropTypes.func.isRequired,
};

module.exports = BidOptimizationTable;
