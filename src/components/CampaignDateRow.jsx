const React = require('react');
const PropTypes = require('prop-types');
const DatePicker = require('react-datepicker').default;

class CampaignDateRow extends React.Component {
    render() {
        if (this.props.showDatePicker && !this.props.onDateChange) {
            throw new Error("Cannot render CampaignDateRow if showDatePicker=true and dateChange is not provided");
        }

        const datePicker = this.props.showDatePicker 
            ? <DatePicker className="machete-date-input-small" selected={this.props.date} onChange={this.props.onDateChange} />
            : null;

        const metrics = this.props.metrics;

        /* the bullshit css on this thing is necessary to make the date picker
         * position properly
         */
        return (
            <tr>
                <td data-mclick="campaign-start-date" style={{maxWidth: '120px'}}>
                    <div style={{display: 'block', position: 'relative', width: '300px'}}>
                        {datePicker}
                    </div>
                </td>
                <td><span className="a-size-small metricValue">{metrics.impressions}</span></td>
                <td><span className="a-size-small metricValue">{metrics.clicks}</span></td>
                <td><span className="a-size-small metricValue">{metrics.avgCpc}</span></td>
                <td><span className="a-size-small metricValue">{metrics.spend}</span></td>
                <td><span className="a-size-small metricValue">{metrics.sales}</span></td>
                <td><span className="a-size-small metricValue">{metrics.acos}</span></td>
            </tr>
        );
    }
}

CampaignDateRow.propTypes = {
    date: PropTypes.object,
    onDateChange: PropTypes.func,
    showDatePicker: PropTypes.bool,
    metrics: PropTypes.object.isRequired,
};

CampaignDateRow.defaultProps = { showDatePicker: true, };

module.exports = CampaignDateRow;
