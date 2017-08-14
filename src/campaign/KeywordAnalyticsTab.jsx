const React = require('react');
const PropTypes = require('prop-types');
const DataNotAvailable = require('../components/DataNotAvailable.jsx');
const KeywordBubbleChart = require('./KeywordBubbleChart.jsx');
const KeywordReport = require('./KeywordReport.jsx');

class KeywordAnalyticsTab extends React.Component {
    render() {
        let body = null;
        if (this.props.allowed) {
            const renderedTables = this.props.keywordTables.map(table => {
                const tableData = this.props.keywordData.filter(table.filterFn ? table.filterFn : () => true);

                // TODO: separate title from column title

                return <KeywordReport
                    key={table.selector}
                    data={tableData}
                    sort={table.order}
                    metric={table.metricFn}
                    formatter={table.formatFn}
                    title={table.columnTitle}
                    columnTitle={table.columnTitle}
                    onKeywordEnabledChange={this.props.onKeywordEnabledChange}
                    onKeywordBidChange={this.props.onKeywordBidChange}
                />;
            });
            body = <div className="a-box-inner">
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
                    {renderedTables}
                </section>
            </div>;
        }
        else {
            body = <div className="a-box-inner">
                <DataNotAvailable allowed={false} anonymous={window.user.isAnon} />
            </div>;
        }

        return (
            <div id="machete-keyword-analysis">
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
    for (let k of data) {
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
    keywordTables: PropTypes.array,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

KeywordAnalyticsTab.defaultProps = {
    keywordData: [],
    keywordTables: [],
};

module.exports = KeywordAnalyticsTab;
