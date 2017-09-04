const React = require('react');
const PropTypes = require('prop-types');
const DataNotAvailable = require('./DataNotAvailable.jsx');
const KeywordBubbleChart = require('./KeywordBubbleChart.jsx');
const KeywordReport = require('./KeywordReport.jsx');

class KeywordAnalyticsTab extends React.Component {
    render() {
        let body = null;
        if (this.props.allowed) {
            const keywordMapper = table => {
                const filterFn = table.filterFn ? table.filterFn : () => true;
                const tableData = this.props.keywordData.filter(filterFn);

                return <KeywordReport
                    key={table.title}
                    title={table.title}
                    data={tableData}
                    modifiedData={this.props.modifiedData}
                    columns={table.columns}
                    onKeywordEnabledChange={this.props.onKeywordEnabledChange}
                    onKeywordBidChange={this.props.onKeywordBidChange}
                />;
            };

            const bestTables = this.props.bestKeywordTables.map(keywordMapper);
            const worstTables = this.props.worstKeywordTables.map(keywordMapper);

            body = <div>
                <section>
                    <h1>Keyword Performance</h1>
                    <KeywordBubbleChart 
                        width={800} height={600}
                        loading={this.props.loading} keywordData={transformKeywordData(this.props.keywordData)} />
                    <div className="machete-explanation">
                        <h3 id="machete-explanation-title">Understanding this chart</h3>
                        <p><b>X-axis</b>: number of impressions</p>
                        <p><b>Y-axis</b>: number of clicks</p>
                        <p><b>Bubble size</b>: total spend</p>
                        <p><b>Bubble color</b>: ACOS (green is lower, red is higher, gray has no recorded sales)</p>
                        <p><b>Drag</b> to zoom in on a region</p>
                    </div>
                </section>
                <section>
                    <h1>Underperforming keywords</h1>
                    {worstTables}
                </section>
                <section>
                    <h1>Overperforming keywords</h1>
                    {bestTables}
                </section>
            </div>;
        }
        else {
            body = <DataNotAvailable allowed={false} anonymous={window.user.isAnon} />;
        }

        return (
            <div id="machete-keyword-analysis" className="a-box-inner">
                {body}
            </div>
        );
    }
}

function transformKeywordData(data) {
    let kws = {
        kw: [],
        impressions: [],
        spend: [],
        sales: [],
        clicks: [],
        acos: [],
        avgCpc: [],
    };
    for (let k of data.filter(kw => kw.enabled)) {
        kws.kw.push(k.keyword);
        kws.impressions.push(k.impressions);
        kws.clicks.push(k.clicks);
        kws.spend.push(k.spend);
        kws.sales.push(k.sales);
        kws.acos.push(k.acos);
        kws.avgCpc.push(k.avgCpc);
    }

    return kws;
}


KeywordAnalyticsTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    loading: PropTypes.bool.isRequired,
    keywordData: PropTypes.array,
    modifiedData: PropTypes.array,
    bestKeywordTables: PropTypes.array,
    worstKeywordTables: PropTypes.array,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

KeywordAnalyticsTab.defaultProps = {
    keywordData: [],
    bestKeywordTables: [],
    worstKeywordTables: [],
};

module.exports = KeywordAnalyticsTab;
