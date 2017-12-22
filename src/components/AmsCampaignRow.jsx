const React = require('react');
const PropTypes = require('prop-types');

const common = require('../common/common.js');

function AmsCampaignRow(props) {
    const campaign = props.campaign;

    return <tr>
        <td className="status-cell"></td>
        <td className="name-cell">{props.label}</td>
        <td></td>
        <td></td>
        <td></td>
        <td className="budget-cell">
            <span className="budget-cell-type">Daily:</span>
            {common.moneyFmt(campaign.budget)}
        </td>
        <td className="right">{common.numberFmt(campaign.impressions, 0)}</td>
        <td className="right">{common.numberFmt(campaign.clicks, 0)}</td>
        <td className="right">{common.moneyFmt(campaign.avgCpc)}</td>
        <td className="right">{common.moneyFmt(campaign.spend)}</td>
        <td className="right">{common.moneyFmt(campaign.salesValue)}</td>
        <td className="right">{common.pctFmt(campaign.acos)}</td>
        <td className="actions-cell"></td>
    </tr>;
}

AmsCampaignRow.propTypes = { campaign: PropTypes.object.isRequired };

module.exports = AmsCampaignRow;
