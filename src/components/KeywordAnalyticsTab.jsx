const React = require('react');
const PropTypes = require('prop-types');
const DataNotAvailable = require('./DataNotAvailable.jsx');
const KeywordBubbleChart = require('./KeywordBubbleChart.jsx');

class KeywordAnalyticsTab extends React.Component {
    render() {
        let body = null;
        if (this.props.allowed) {
            body = <div className="a-box-inner">
                <section>
                    <h1>Keyword Performance</h1>
                    <KeywordBubbleChart 
                        width={800} height={600}
                        loading={this.props.loading} keywordData={this.props.keywordData} />
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
                    Phat tables.
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

KeywordAnalyticsTab.propTypes = {
    allowed: PropTypes.bool.isRequired,
    loading: PropTypes.bool.isRequired,
    keywordData: PropTypes.array.isRequired,
};

module.exports = KeywordAnalyticsTab;
