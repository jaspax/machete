const React = require('react');
const PropTypes = require('prop-types');
const KeywordAnalyticsTab = require('./KeywordAnalyticsTab.jsx');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

class KeywordAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        if (this.props.loading) {
            return <KeywordAnalyticsTab 
                allowed={true}
                loading={true}
                onKeywordEnabledChange={() => console.warn("shouldn't update keywords while still loading")}
                onKeywordBidChange={() => console.warn("shouldn't update keywords while still loading")}
            />;
        }

        let data = this.props.keywordData;

        let totalImpressions = data.reduce((acc, val) => acc + val.impressions, 0);
        let minImpressions = totalImpressions / (data.length * 10);

        // Calculate these two derived metrics once, because we use them
        // multiple times below
        for (let kw of data) {
            kw.hasEnoughImpressions = kw.clicks && kw.impressions > minImpressions;
        }

        let salesTopQuartile = data.sort((a, b) => b.sales - a.sales)[Math.round(data.length / 4)];
        let ctrSort = data.filter(x => x.hasEnoughImpressions).sort((a, b) => a.ctr - b.ctr);
        let ctrBottomQuartile = 0;
        let ctrTopQuartile = 0;
        if (ctrSort.length) {
            ctrBottomQuartile = ctrSort[Math.round((ctrSort.length - 1) * 0.25)].ctr;
            ctrTopQuartile = ctrSort[Math.round((ctrSort.length - 1) * 0.75)].ctr;
        }

        const worstKwTables = [{
            title: 'Keywords with ACOS over 100%',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: x => x.clicks && x.acos > 100,
            metricFn: x => x.acos,
            formatFn: common.pctFmt,
        }, {
            title: 'Keywords with low click-through rate (CTR)',
            columnTitle: 'CTR',
            order: 'asc',
            filterFn: x => x.hasEnoughImpressions && x.ctr <= ctrBottomQuartile,
            metricFn: x => x.ctr,
            formatFn: common.pctFmt,
        }, {
            title: 'Keywords spending money without sales',
            columnTitle: 'Spend',
            order: 'desc',
            filterFn: x => x.clicks && !x.sales,
            metricFn: x => x.spend,
            formatFn: common.moneyFmt,
        }, {
            title: 'Keywords with few impressions',
            columnTitle: 'Impressions',
            order: 'asc',
            filterFn: x => x.impressions < minImpressions,
            metricFn: x => x.impressions,
            formatFn: x => x || 0,
        }];
        
        const bestKwTables = [{
            title: 'Keywords with high click-through rate (CTR)',
            columnTitle: 'CTR',
            order: 'desc',
            filterFn: x => x.hasEnoughImpressions && x.ctr >= ctrTopQuartile,
            metricFn: x => x.ctr,
            formatFn: common.pctFmt,
        }, {
            title: 'Keywords with low ACOS',
            columnTitle: 'ACOS',
            order: 'asc',
            filterFn: x => x.sales && x.acos < 100 && x.acos > 0,
            metricFn: x => x.acos,
            formatFn: common.pctFmt,
        }, {
            title: 'Keywords with highest profit (sales - spend)',
            columnTitle: 'Profit',
            order: 'desc',
            filterFn: x => x.sales && x.acos < 100,
            metricFn: x => x.sales - x.spend,
            formatFn: common.moneyFmt,
        }, {
            title: 'Keywords with highest gross sales',
            columnTitle: 'Sales',
            order: 'desc',
            filterFn: x => x.sales && x.sales >= salesTopQuartile.sales,
            metricFn: x => x.sales,
            formatFn: common.moneyFmt,
        }, {
            title: 'Disabled keywords',
            columnTitle: 'ACOS',
            order: 'desc',
            filterFn: x => !x.enabled,
            metricFn: x => x.acos,
            formatFn: common.pctFmt,
        }];

        return <KeywordAnalyticsTab 
            allowed={this.props.allowed} 
            loading={false}
            keywordData={data}
            modifiedData={this.state.modified}
            worstKeywordTables={worstKwTables}
            bestKeywordTables={bestKwTables}
            onKeywordEnabledChange={this.updateStatus.bind(this)}
            onKeywordBidChange={this.updateBid.bind(this)}
        />;
    }

    updateStatus(enabled, keywords) {
        this.keywordModify(this.props.updateStatus, keywords, enabled, kw => kw.enabled = enabled);
    }

    updateBid(bid, keywords) {
        this.keywordModify(this.props.updateBid, keywords, bid, kw => kw.bid = bid);
    }

    keywordModify(modifier, keywords, value, onSuccess) {
        modifier(keywords.map(kw => kw.id), value, result => {
            if (result.success) {
                keywords.forEach(onSuccess);
            }
            else {
                ga.merror('enabled update error:', result);
            }
            this.setState({ modified: keywords });
        });
    }
}

KeywordAnalysis.propTypes = {
    loading: PropTypes.bool.isRequired,
    allowed: PropTypes.bool.isRequired,
    keywordData: PropTypes.array.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
};

module.exports = KeywordAnalysis;
