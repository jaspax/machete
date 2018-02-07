const React = require('react');
const PropTypes = require('prop-types');
const AmsCampaignTitleCell = require('./AmsCampaignTitleCell.jsx');

const common = require('../common/common.js');

function AmsCampaignRow(props) {
    const campaign = props.totals;
    const lastDay = props.lastDay;
    return <tr>
        <td className="status-cell"></td>
        <td className="name-cell">
            <AmsCampaignTitleCell title={props.label} syncPromise={props.syncPromise} />
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td className="budget-cell">
            <span className="budget-cell-type">Daily:</span>
            {common.moneyFmt(campaign.budget)}
        </td>
        <td className="right">
            <div>{common.numberFmt(campaign.impressions, 0)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.numberFmt(lastDay.impressions, 0)}
            </div>
        </td>
        <td className="right">
            <div>{common.numberFmt(campaign.clicks, 0)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.numberFmt(lastDay.clicks, 0)}
            </div>
        </td>
        <td className="right">
            <div>{common.moneyFmt(campaign.avgCpc)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.moneyFmt(lastDay.avgCpc)}
            </div>
        </td>
        <td className="right">
            <div>{common.moneyFmt(campaign.spend)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.moneyFmt(lastDay.spend)}
            </div>
        </td>
        <td className="right">
            <div>{common.moneyFmt(campaign.salesValue)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.moneyFmt(lastDay.salesValue)}
            </div>
        </td>
        <td className="right">
            <div>{common.pctFmt(campaign.acos)}</div>
            <div>
                <span className="machete-ghost">24h:</span>
                {common.pctFmt(lastDay.acos)}
            </div>
        </td>
        <td className="actions-cell"></td>
    </tr>;
}

AmsCampaignRow.propTypes = {
    label: PropTypes.string.isRequired,
    totals: PropTypes.object.isRequired,
    lastDay: PropTypes.object.isRequired,
    syncPromise: PropTypes.object.isRequired,
};

module.exports = AmsCampaignRow;
