const React = require('react');
const PropTypes = require('prop-types');
const CampaignDateRow = require('./CampaignDateRow.jsx');

class CampaignDateRangeTable extends React.Component {
    constructor(props) {
        super(props);
        this.startDateChange = this.startDateChange.bind(this);
        this.endDateChange = this.endDateChange.bind(this);
    }

    render() {
        const startMetrics = this.props.startMetrics;
        const endMetrics = this.props.endMetrics;
        const diffMetrics = {
            impressions: endMetrics.impressions - startMetrics.impressions,
            clicks: endMetrics.clicks - startMetrics.clicks,
            avgCpc: endMetrics.avgCpc - startMetrics.avgCpc,
            spend: endMetrics.spend- startMetrics.spend,
            salesCount: endMetrics.salesCount - startMetrics.salesCount,
            acos: endMetrics.acos - startMetrics.acos,
        };

        return (
            <table className="machete-metrics-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Impressions</th>
                        <th>Clicks</th>
                        <th>Average CPC</th>
                        <th>Spend</th>
                        <th>Sales</th>
                        <th>ACOS</th>
                    </tr>
                </thead>
                <tbody>
                    <CampaignDateRow date={this.props.startDate} onDateChange={this.startDateChange} metrics={startMetrics} />
                    <CampaignDateRow date={this.props.endDate} onDateChange={this.endDateChange} metrics={endMetrics} />
                    <CampaignDateRow showDatePicker={false} firstColumnText="Change between dates" metrics={diffMetrics} />
                </tbody>
            </table>
        );
    }

    startDateChange(date) {
        this.props.onRangeChange({start: date, end: this.props.endDate});
    }
    
    endDateChange(date) {
        this.props.onRangeChange({start: this.props.startDate, end: date});
    }
}

CampaignDateRangeTable.propTypes = {
    startDate: PropTypes.object.isRequired,
    startMetrics: PropTypes.object.isRequired,
    endDate: PropTypes.object.isRequired,
    endMetrics: PropTypes.object.isRequired,
    onRangeChange: PropTypes.func.isRequired,
};

module.exports = CampaignDateRangeTable;
