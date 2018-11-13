const React = require('react');
const PropTypes = require('prop-types');
const ErrorBoundary = require('./ErrorBoundary.jsx');
const KeywordBubbleChart = require('./KeywordBubbleChart.jsx');
const KeywordReport = require('./KeywordReport.jsx');

function KeywordAnalyticsView(props) {
    const keywordMapper = table => {
        const filterFn = table.filterFn ? table.filterFn : () => true;
        const tableData = props.keywordData.filter(filterFn);

        return <KeywordReport
                key={table.title}
                title={table.title}
                data={tableData}
                modifiedData={props.modifiedData}
                columns={table.columns}
                campaignPromise={props.campaignPromise}
                onKeywordEnabledChange={props.onKeywordEnabledChange}
                onKeywordBidChange={props.onKeywordBidChange}
                onKeywordCopy={props.onKeywordCopy}
        />;
    };

    const bestTables = props.bestKeywordTables.map(keywordMapper);
    const worstTables = props.worstKeywordTables.map(keywordMapper);

    return <div className="machete-report">
        <ErrorBoundary>
            <section>
                <KeywordBubbleChart width={800} height={600}
                    keywordData={transformKeywordData(props.keywordData)} />
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
                <h1>Keyword Detail Reports</h1>
                {worstTables}
                {bestTables}
            </section>
        </ErrorBoundary>
    </div>;
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

KeywordAnalyticsView.propTypes = {
    keywordData: PropTypes.array,
    campaignPromise: PropTypes.object.isRequired,
    modifiedData: PropTypes.array,
    bestKeywordTables: PropTypes.array,
    worstKeywordTables: PropTypes.array,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
    onKeywordCopy: PropTypes.func.isRequired,
};

KeywordAnalyticsView.defaultProps = {
    keywordData: [],
    bestKeywordTables: [],
    worstKeywordTables: [],
};

module.exports = KeywordAnalyticsView;
