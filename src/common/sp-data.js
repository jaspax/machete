/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const moment = require('frozen-moment');
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

function getAdGroupIdFromDOM(dom) {
    const adGroupIdInput = dom.querySelector('input[name=adGroupId]');
    return adGroupIdInput.value;
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

async function getCampaignAllowed(entityId = getEntityId(), campaignId = getCampaignId()) {
    try {
        const allowed = await getAllCampaignsAllowed(entityId);
        if (!allowed) {
            return false;
        }
        if (allowed[0] == '*') {
            return true;
        }
        return allowed.includes(campaignId);
    }
    catch (ex) {
        return false;
    }
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

async function getAllowedCampaignSummaries(entityId = getEntityId()) {
    const summaries = await getCampaignSummaries(entityId);
    const rv = [];
    for (const summary of summaries) {
        if (await getCampaignAllowed(entityId, summary.campaignId)) {
            rv.push(summary);
        }
    }
    return summaries;
}

async function getCampaignSummary(entityId = getEntityId(), campaignId = getCampaignId()) {
    const summaries = await getCampaignSummaries(entityId);
    return summaries.find(x => x.campaignId == campaignId);
}

function getKdpSalesHistory(asin) {
    return common.bgMessage({
        action: 'kdp.getSalesHistory',
        asin,
    });
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
    return campaignSummary && ['RUNNING', 'OUT_OF_BUDGET', null].includes(campaignSummary.status || null);
}

function calculateKnpIncome(amsSales, kdpSales) {
    if (!kdpSales)
        return amsSales;

    return amsSales.map(item => {
        const itemDate = moment(item.timestamp).startOf('day').freeze();
        const salesWindow = salesWindowFilter(itemDate.subtract(15, 'days'), itemDate);
        const kdpWindow = kdpSales.filter(salesWindow);
        const amsWindow = amsSales.filter(salesWindow);
        const kdpSalesCount = kdpWindow.reduce((sum, item) => sum + item.paidEbook + item.paidPaperback, 0);
        const amsSalesCount = amsWindow.reduce((sum, item) => sum + (item.salesCount || 0), 0);
        const ratio = kdpSalesCount ? amsSalesCount / kdpSalesCount : 0;

        const rv = Object.assign({}, item);
        const kdpOnDate = kdpSales.find(x => moment(x.date).isSame(itemDate, 'day'));
        if (kdpOnDate) {
            const sales = item.salesValue || item.sales || 0; // salesValue for campaigns, sales for keywords
            rv.knpeCount = kdpOnDate.knp * ratio;
            rv.knpeValue = rv.knpeCount * 0.005;
            rv.knpeTotalValue = sales + rv.knpeValue;
            rv.knpeAcos = rv.knpeTotalSales ? 100 * (rv.spend / rv.knpeTotalSales) : null;
        }
        else {
            rv.knpeCount = null;
            rv.knpeValue = null;
            rv.knpeTotalValue = null;
            rv.knpeAcos = null;
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

let startSessionPromise = null; 
function startSession() {
    if (!startSessionPromise) {
        startSessionPromise = common.bgMessage({
            action: 'startSession', 
            entityId: getEntityId(), 
        });
    }
    return startSessionPromise;
}

function amsPageInit() {
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
}

function requestKdpIntegration() {
    return common.bgMessage({ action: 'kdp.requestPermission' });
}

function hasKdpIntegration() {
    return common.bgMessage({ action: 'kdp.hasPermission' });
}

module.exports = {
    amsPageInit,
    getEntityId,
    getCampaignId,
    getQueryArgs,
    getAdGroupIdFromDOM,
    getCurrentCampaignSnapshot,
    getCampaignHistory,
    getAggregateCampaignHistory,
    getKeywordData,
    getAggregateKeywordData,
    getAllCampaignsAllowed,
    getCampaignAllowed,
    getCampaignSummaries,
    getAllowedCampaignSummaries,
    getCampaignSummary,
    getKdpSalesHistory,
    updateKeywordStatus,
    updateKeywordBid,
    isRunning,
    startSession,
    calculateKnpIncome,
    requestKdpIntegration,
    hasKdpIntegration,
};
