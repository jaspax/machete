/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const moment = require('moment');
const ga = require('./ga.js');
const common = require('./common.js');
const constants = require('./constants.js');

function getEntityId(href) {
    let entityId = getQueryArgs(href).entityId;
    if (entityId) {
        return entityId;
    }

    let navLink = $('.topNavLogo')[0].href;
    let query = navLink.substring(navLink.indexOf('?') + 1);
    entityId = getQueryArgs(query).entityId;
    if (entityId) {
        return entityId;
    }

    throw new Error('could not discover entityId');
}

function getCampaignId(href) {
    let campaignId = getQueryArgs(href).campaignId;
    if (campaignId) {
        return campaignId;
    }

    campaignId = $('input[name=campaignId]').val();
    if (campaignId) {
        return campaignId;
    }

    throw new Error('could not discover entityId');
}

function getQueryArgs(str) {
    let qstring = str || window.location.toString();
    qstring = qstring.split('?').pop();
    if (qstring.includes('#')) {
        qstring = qstring.substring(0, qstring.lastIndexOf('#'));
    }

    let qs = qstring.split('&');
    let args = {};
    for (let q of qs) {
        let parts = q.split('=');
        args[parts[0]] = parts[1];
    }
    return args;
}

function getCurrentCampaignSnapshot(entityId = getEntityId(), campaignId = getCampaignId()) {
    return getCampaignSummaries(entityId).then(summaries => {
        const summary = summaries.find(x => x.campaignId == campaignId);
        return summary.lifetimeData;
    });
}

function getCampaignHistory(entityId = getEntityId(), campaignId = getCampaignId()) {
    return common.bgMessage({
        action: 'sp.getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    });
}

function getAggregateCampaignHistory(entityId = getEntityId(), campaignIds) {
    return common.bgMessage({
        action: 'sp.getAggregateCampaignHistory', 
        entityId,
        campaignIds,
    });
}

function getKeywordData(entityId = getEntityId(), adGroupId) {
    return common.bgMessage({
        action: 'sp.getKeywordData',
        entityId,
        adGroupId,
    });
}

function getAggregateKeywordData(entityId = getEntityId(), adGroupIds) {
    return common.bgMessage({
        action: 'sp.getAggregateKeywordData',
        entityId,
        adGroupIds
    });
}

let allowedPromise = null;
function getAllCampaignsAllowed(entityId = getEntityId()) {
    if (!allowedPromise) {
        allowedPromise = common.bgMessage({
            action: 'sp.getAllowedCampaigns', 
            entityId
        });
    }
    return allowedPromise;
}

function getCampaignAllowed(entityId = getEntityId(), campaignId = getCampaignId()) {
    return getAllCampaignsAllowed(entityId)
    .then(allowed => {
        if (!allowed) {
            return false;
        }
        if (allowed[0] == '*') {
            return true;
        }
        return allowed.includes(campaignId);
    }).catch(() => false);
}

let summaryPromise = null;
function getCampaignSummaries(entityId = getEntityId()) {
    if (!summaryPromise) {
        summaryPromise = common.bgMessage({
            action: 'sp.getCampaignSummaries',
            entityId: entityId,
        });
    }
    return summaryPromise;
}

function updateKeyword(keywordIdList, operation, dataValues) {
    return common.bgMessage({
        action: 'sp.updateKeyword',
        entityId: getEntityId(),
        keywordIdList,
        operation,
        dataValues,
    });
}

function updateKeywordStatus(keywordIdList, enable) {
    let operation = enable ? "ENABLE" : "PAUSE";
    return updateKeyword(keywordIdList, operation, {});
}

function updateKeywordBid(keywordIdList, bid) {
    bid = parseFloat(bid).toFixed(2).toString();
    return updateKeyword(keywordIdList, 'UPDATE', {bid});
}

function isRunning(campaignSummary) {
    return ['RUNNING', 'OUT_OF_BUDGET'].includes(campaignSummary.status);
}

function calculateKnpIncome(amsSales, kdpSales) {
    return amsSales.map(item => {
        const salesWindow = salesWindowFilter(moment(item.timestamp).subtract(15, 'days').startOf('day'), moment(item.timestamp).startOf('day'));
        const kdpWindow = kdpSales.filter(salesWindow);
        const amsWindow = amsSales.filter(salesWindow);
        const kdpSalesCount = kdpWindow.reduce((sum, item) => sum + item.paidEbook + item.paidPaperback, 0);
        const amsSalesCount = amsWindow.reduce((sum, item) => sum + (item.salesCount || 0), 0);
        const ratio = amsSalesCount ? kdpSalesCount / amsSalesCount : 0;

        const rv = Object.assign({}, item);
        const kdpOnDate = kdpSales.find(x => moment(x.date).isSame(item.timestamp));
        if (kdpOnDate) {
            const sales = item.salesValue || item.sales || 0; // salesValue for campaigns, sales for keywords
            rv.knpeCount = kdpOnDate.knp * ratio;
            rv.knpeValue = rv.knpeCount * 0.005;
            rv.knpeTotalValue = sales + rv.knpeValue;
            rv.knpeAcos = rv.knpeTotalSales ? 100 * (rv.spend / rv.knpeTotalSales) : null;
        }
        
        return rv;
    });
}

function salesWindowFilter(startDate, endDate) {
    return item => {
        const date = moment(item.date || item.timestamp);
        return date.isSameOrBefore(endDate) && date.isAfter(startDate);
    };
}

const startSessionPromise = common.bgMessage({
    action: 'startSession', 
    entityId: getEntityId(), 
});

common.getUser().then(ga.mcatch(user => {
    const desc = user.activeSubscription.name;
    let email = user.email;
    let profileText = "Your Profile";
    let label = 'view-profile';
    if (user.isAnon) {
        email = '';
        profileText = 'Login/Register';
        label = 'login';
    }
    let links = $('.userBarLinksRight');
    if (links[0]) {
        let chunks = links[0].innerHTML.split(' | ');
        chunks.splice(-1, 0, `${desc} (<a data-mclick="machete-status ${label}" title="${email}" href="https://${constants.hostname}/profile" target="_blank">${profileText}</a>)`);
        links[0].innerHTML = chunks.join(' | ');
    }
    let logout = links.find('a');
    if (logout[1]) {
        $(logout[1]).click(ga.mcatch(() => {
            const result = confirm(
                `Logging out of AMS will prevent Machete from monitoring your campaigns. Instead, you may close this tab without logging out.
                    
                Continue logging out?`);
            return result;
        }));
    }
}));

module.exports = {
    getEntityId,
    getCampaignId,
    getQueryArgs,
    getCurrentCampaignSnapshot,
    getCampaignHistory,
    getAggregateCampaignHistory,
    getKeywordData,
    getAggregateKeywordData,
    getAllCampaignsAllowed,
    getCampaignAllowed,
    getCampaignSummaries,
    updateKeywordStatus,
    updateKeywordBid,
    isRunning,
    startSessionPromise,
    calculateKnpIncome,
};
