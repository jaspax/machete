const React = require('react');
const PropTypes = require('prop-types');
const KeywordAnalyticsView = require('./KeywordAnalyticsView.jsx');
const Async = require('react-promise');

const common = require('../common/common.js');
const ga = require('../common/ga.js');

class KeywordAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        return <Async promise={this.props.dataPromise}
            pending={this.pending()} then={this.after.bind(this)} />;
    }

    pending() { // eslint-disable-line class-methods-use-this
        const loadingStyle = {
            width: '100%',
            height: 200,
        };
        return <div className="loading-large" style={loadingStyle}>&nbsp;</div>;
    }

    after(data) {
        let totalImpressions = data.reduce((acc, val) => acc + val.impressions, 0);
        let minImpressions = totalImpressions / (data.length * 10);

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
            filterFn: x => x.clicks && x.acos > 100,
            columns: [{
                title: 'ACOS',
                sort: 'desc',
                metric: x => x.acos,
                format: common.pctFmt,
            }, {
                title: 'Spend',
                metric: x => x.spend,
                format: common.moneyFmt,
            }, {
                title: 'Sales',
                metric: x => x.sales,
                format: common.moneyFmt,
            }, {
                title: 'Loss',
                metric: x => x.spend - x.sales,
                format: common.moneyFmt,
            }]
        }, {
            title: 'Keywords with low click-through rate (CTR)',
            filterFn: x => x.hasEnoughImpressions && x.ctr <= ctrBottomQuartile,
            columns: [{
                title: 'CTR',
                sort: 'asc',
                metric: x => x.ctr,
                format: common.pctFmt,
            }, {
                title: 'Impressions',
                metric: x => x.impressions,
            }, {
                title: 'Clicks',
                metric: x => x.clicks
            }, {
                title: 'ACOS', 
                metric: x => x.acos,
                format: common.pctFmt,
            }]
        }, {
            title: 'Keywords spending money without sales',
            filterFn: x => x.clicks && !x.sales,
            columns: [{
                title: 'Spend',
                sort: 'desc',
                metric: x => x.spend,
                format: common.moneyFmt,
            }, {
                title: 'Clicks',
                metric: x => x.clicks,
            }, {
                title: 'Avg CPC',
                metric: x => x.avgCpc,
                format: common.moneyFmt,
            }]
        }, {
            title: 'Keywords with few impressions',
            filterFn: x => x.impressions < minImpressions,
            columns: [{
                title: 'Impressions',
                sort: 'asc',
                metric: x => x.impressions,
                format: x => x || 0,
            }, {
                title: 'ACOS', 
                metric: x => x.acos,
                format: common.pctFmt,
            }]
        }];
        
        const bestKwTables = [{
            title: 'Keywords with high click-through rate (CTR)',
            filterFn: x => x.hasEnoughImpressions && x.ctr >= ctrTopQuartile,
            columns: [{
                title: 'CTR',
                sort: 'desc',
                metric: x => x.ctr,
                format: common.pctFmt,
            }, {
                title: 'Impressions',
                metric: x => x.impressions,
            }, {
                title: 'Clicks',
                metric: x => x.clicks
            }, {
                title: 'ACOS', 
                metric: x => x.acos,
                format: common.pctFmt,
            }]
        }, {
            title: 'Keywords with low ACOS',
            filterFn: x => x.sales && x.acos < 100 && x.acos > 0,
            columns: [{
                title: 'ACOS',
                sort: 'asc',
                metric: x => x.acos,
                format: common.pctFmt,
            }, {
                title: 'Spend',
                metric: x => x.spend,
                format: common.moneyFmt,
            }, {
                title: 'Sales',
                metric: x => x.sales,
                format: common.moneyFmt,
            }, {
                title: 'Profit',
                metric: x => x.sales - x.spend,
                format: common.moneyFmt,
            }]
        }, {
            title: 'Keywords with highest profit',
            filterFn: x => x.sales && x.acos < 100,
            columns: [{
                title: 'Profit',
                sort: 'desc',
                metric: x => x.sales - x.spend,
                format: common.moneyFmt,
            }, {
                title: 'Spend',
                metric: x => x.spend,
                format: common.moneyFmt,
            }, {
                title: 'Sales',
                metric: x => x.sales,
                format: common.moneyFmt,
            }, {
                title: 'ACOS', 
                metric: x => x.acos,
                format: common.pctFmt,
            }]
        }, {
            title: 'Keywords with highest gross sales',
            filterFn: x => x.sales && x.sales >= salesTopQuartile.sales,
            columns: [{
                title: 'Sales',
                sort: 'desc',
                metric: x => x.sales,
                format: common.moneyFmt,
            }, {
                title: 'ACOS',
                metric: x => x.acos,
                format: common.pctFmt,
            }, {
                title: 'Spend',
                metric: x => x.spend,
                format: common.moneyFmt,
            }]
        }, {
            title: 'Disabled keywords',
            filterFn: x => !x.enabled,
            columns: [{
                title: 'ACOS',
                sort: 'desc',
                metric: x => x.acos,
                format: common.pctFmt,
            }, {
                title: 'Impressions',
                metric: x => x.impressions,
            }, {
                title: 'Clicks',
                metric: x => x.clicks
            }]
        }];

        return <KeywordAnalyticsView 
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
    dataPromise: PropTypes.object.isRequired,
    updateStatus: PropTypes.func.isRequired,
    updateBid: PropTypes.func.isRequired,
};

module.exports = KeywordAnalysis;
