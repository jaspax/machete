const React = require('react');
const PropTypes = require('prop-types');
const ErrorBoundary = require('./ErrorBoundary.jsx');
const KeywordTable = require('./KeywordTable.jsx');
const KeywordBulkUpdate = require('./KeywordBulkUpdate.jsx');
const Collapsible = require('react-collapsible').default;
const DownloadButton = require('./DownloadButton.jsx');
const csv = require('csv-stringify');
const common = require('../common/common.js');
const $ = require('jquery');

const ga = require('../common/ga.js');

class KeywordReport extends React.Component {
    render() {
        return <Collapsible trigger={this.props.title} lazyRender={true} onOpen={this.onOpen.bind(this)} transitionTime={200}>
            <ErrorBoundary>
                <div style={{height: '48px'}}>
                    <DownloadButton title="Download this report" onClick={this.generateDownloadCsv.bind(this)} />
                    <KeywordBulkUpdate
                        data={this.props.data}
                        onEnabledChange={this.props.onKeywordEnabledChange}
                        onBidChange={this.props.onKeywordBidChange}
                    />
                </div>
                <div style={{clear: 'both'}}>
                    <KeywordTable
                        data={this.props.data}
                        columns={this.props.columns}
                        onKeywordEnabledChange={singleKeywordChange(this.props.onKeywordEnabledChange)}
                        onKeywordBidChange={singleKeywordChange(this.props.onKeywordBidChange)}
                    />
                </div>
            </ErrorBoundary>
        </Collapsible>;
    }

    onOpen() {
        ga.revent('kwReportOpen', { title: this.props.title });
    }

    shouldComponentUpdate(nextProps) {
        if (!nextProps.modifiedData) {
            return true;
        }
        for (let item of nextProps.modifiedData) {
            if (this.props.data.includes(item) || nextProps.data.includes(item)) {
                return true;
            }
        }
        return false;
    }

    generateDownloadCsv(evt) {
        evt.preventDefault();
        if (!this.props.data) {
            return;
        }
        const data = this.props.data.map(x => ({
            "Keyword": x.keyword || '',
            "Impressions": x.impressions,
            "Clicks": x.clicks,
            "Sales (units)": x.salesCount,
            "Sales (value)": common.numberFmt(x.salesValue),
            "Spend": common.numberFmt(x.spend),
            "ACOS": common.numberFmt(x.acos),
            "Average CPC": common.numberFmt(x.avgCpc),
        }));
        csv(data, { header: true }, (error, data) => {
            if (error) {
                // TODO: report errors
                return ga.merror(error);
            }
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            $(`<a href='${url}' download='${this.props.title}.csv'></a>`)[0].click();

            return url;
        });
    }
}

function singleKeywordChange(handler) {
    return ga.mcatch((value, item) => handler(value, [item]));
}

KeywordReport.propTypes = {
    title: PropTypes.string.isRequired,
    data: PropTypes.array.isRequired,
    modifiedData: PropTypes.array,
    columns: PropTypes.array.isRequired,
    onKeywordEnabledChange: PropTypes.func.isRequired,
    onKeywordBidChange: PropTypes.func.isRequired,
};

module.exports = KeywordReport;
