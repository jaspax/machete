const React = require('react');
const PropTypes = require('prop-types');
const DatePicker = require('react-datepicker').default;

const common = require('../common/common.js');

class CampaignDateRow extends React.Component {
    render() {
        if (this.props.showDatePicker && !this.props.onDateChange) {
            throw new Error("Cannot render CampaignDateRow if showDatePicker=true and dateChange is not provided");
        }

        const firstColumn = this.props.showDatePicker 
            ? <DatePicker className="machete-date-input-small" selected={this.props.date} onChange={this.props.onDateChange} />
            : <b>{this.props.firstColumnText}</b>;

        const metrics = this.props.metrics;

        /* the bullshit css on this thing is necessary to make the date picker
         * position properly
         */
        return (
            <tr>
                <td data-mclick="campaign-start-date" style={{maxWidth: '120px'}}>
                    <div style={{display: 'block', position: 'relative', width: '300px'}}>
                        {firstColumn}
                    </div>
                </td>
                <td><span className="a-size-small metricValue">{common.roundFmt(metrics.impressions)}</span></td>
                <td><span className="a-size-small metricValue">{common.roundFmt(metrics.clicks)}</span></td>
                <td><span className="a-size-small metricValue">{common.moneyFmt(metrics.avgCpc)}</span></td>
                <td><span className="a-size-small metricValue">{common.moneyFmt(metrics.spend)}</span></td>
                <td><span className="a-size-small metricValue">{common.moneyFmt(metrics.salesValue)}</span></td>
                <td><span className="a-size-small metricValue">{common.pctFmt(metrics.acos)}</span></td>
            </tr>
        );
    }
}

CampaignDateRow.propTypes = {
    date: PropTypes.object,
    onDateChange: PropTypes.func,
    showDatePicker: PropTypes.bool,
    firstColumnText: PropTypes.string,
    metrics: PropTypes.object.isRequired,
};

CampaignDateRow.defaultProps = { showDatePicker: true, };

module.exports = CampaignDateRow;
