/* eslint-disable no-unused-vars */
const $ = require('jquery');
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

function getCampaignHistory(entityId = getEntityId(), campaignId = getCampaignId()) {
    return common.bgMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    });
}

function getAggregateCampaignHistory(entityId = getEntityId(), campaignIds) {
    return common.bgMessage({
        action: 'getAggregateCampaignHistory', 
        entityId,
        campaignIds,
    });
}

function getKeywordData(entityId = getEntityId(), adGroupId) {
    return common.bgMessage({
        action: 'getKeywordData',
        entityId,
        adGroupId,
    });
}

function getAggregateKeywordData(entityId = getEntityId(), adGroupIds) {
    return common.bgMessage({
        action: 'getAggregateKeywordData',
        entityId,
        adGroupIds
    });
}

let allowedPromise = null;
function getAllCampaignsAllowed(entityId = getEntityId()) {
    if (!allowedPromise) {
        allowedPromise = common.bgMessage({
            action: 'getAllowedCampaigns', 
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
            action: 'getCampaignSummaries',
            entityId: entityId,
        });
    }
    return summaryPromise;
}

function updateKeyword(keywordIdList, operation, dataValues) {
    return common.bgMessage({
        action: 'updateKeyword',
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

common.bgMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
})
.then(() => console.info('setSession success'))
.catch(() => console.warn('setSession failure'));

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
        $(logout[1]).click(() => {
            const result = confirm(
                `Logging out of AMS will prevent Machete from monitoring your campaigns. Instead, you may close this tab without logging out.
                    
                Continue logging out?`);
            return result;
        });
    }
}));

module.exports = {
    getEntityId,
    getCampaignId,
    getQueryArgs,
    getCampaignHistory,
    getAggregateCampaignHistory,
    getKeywordData,
    getAggregateKeywordData,
    getAllCampaignsAllowed,
    getCampaignAllowed,
    getCampaignSummaries,
    updateKeywordStatus,
    updateKeywordBid,
};
