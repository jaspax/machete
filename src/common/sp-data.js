/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const moment = require('frozen-moment');
const ga = require('./ga.js');
const common = require('./common.js');
const constants = require('./constants.js');

function getEntityId(href = window.location.toString()) {
    let entityId = getQueryArgs(href).entityId;
    if (entityId) {
        return entityId;
    }

    let navLink = $('.topNavLogo')[0];
    if (navLink) {
        let navHref = navLink.href;
        let query = navHref.substring(navHref.indexOf('?') + 1);
        entityId = getQueryArgs(query).entityId;
        if (entityId) {
            return entityId;
        }
    }

    throw new Error('could not discover entityId');
}

function stripPrefix(id) {
    if (!id)
        return id;
    if (!id.replace)
        return id;
    return id.replace(/^AX?/, '');
} 

function getCampaignId(href = window.location.toString()) {
    let campaignId = getQueryArgs(href).campaignId;
    if (campaignId) {
        return stripPrefix(campaignId);
    }

    if (href) {
        const rawId = getUriPathChunk(href, 'campaigns');
        return stripPrefix(rawId);
    }

    campaignId = $('input[name=campaignId]').val();
    if (campaignId)
        return stripPrefix(campaignId);

    throw new Error('could not discover campaignId');
}

// take a uri like host.com/foo/1/ and extract the "1" given "foo"
function getUriPathChunk(href, chunk) {
    let path = href.split('?')[0];
    let parts = path.split('/');
    let nameIndex = parts.indexOf(chunk);
    if (nameIndex >= 0) {
        return parts[nameIndex + 1];
    }
    return null;
}

function getQueryArgs(str = window.location.toString()) {
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
    if (adGroupIdInput)
        return stripPrefix(adGroupIdInput.value);

    const sspaLink = dom.querySelector('.page-container nav li a');
    if (sspaLink)
        return stripPrefix(getUriPathChunk(sspaLink.href, 'ad-groups'));

    const scripts = dom.querySelectorAll('script');
    for (const script of scripts) {
        const match = script.innerText.match(/adGroupId: *"(.*)"/);
        if (match) {
            return match[1];
        }
    }

    return null;
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

function getKeywordData(entityId = getEntityId(), campaignId = getCampaignId(), adGroupId) {
    return common.bgMessage({
        action: 'sp.getKeywordData',
        entityId,
        campaignId,
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

function storeAdGroupMetadata(entityId, campaignId, adGroupId) {
    return common.bgMessage({
        action: 'sp.storeAdGroupMetadata',
        entityId,
        campaignId,
        adGroupId,
    });
}

function updateKeyword(keywords, operation, dataValues) {
    return common.bgMessage({
        action: 'sp.updateKeyword',
        entityId: getEntityId(),
        keywords,
        operation,
        dataValues,
    });
}

function updateKeywordStatus(enable, keywords) {
    let operation = enable ? "ENABLE" : "PAUSE";
    return updateKeyword(keywords, operation, {});
}

function updateKeywordBid(bid, keywords) {
    bid = parseFloat(bid).toFixed(2).toString();
    return updateKeyword(keywords, 'UPDATE', {bid});
}

function addKeywords(adGroupId, keywords, bid) {
    return common.bgMessage({
        action: 'sp.addKeywords',
        entityId: getEntityId(),
        adGroupId,
        keywords,
        bid,
    });
}

async function copyKeywordsToCampaigns(campaigns, keywords) {
    const rv = {
        ok: [],
        fail: []
    };
    for (const campaign of campaigns) {
        const result = await common.bgMessage({
            action: 'sp.addKeywords',
            entityId: getEntityId(),
            campaignId: campaign.campaignId,
            adGroupId: campaign.adGroupId,
            keywords: keywords,
        });
        rv.ok.push(...result.ok);
        rv.fail.push(...result.fail);
    }

    return rv;
}

function isRunning(campaignSummary) {
    return campaignSummary && ['RUNNING', 'OUT_OF_BUDGET', 'ENABLED', null].includes(campaignSummary.status || null);
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

        window.setInterval(addDashboardLinks, 250);

        let brandName = null;
        const brandNameDiv = $('#currentBrandName');
        if (brandNameDiv.length)
            brandName = brandNameDiv[0].innerText;
        if (!brandName) {
            const accountLink = $('.kdpUserBarLinksRight').find('a').first();
            if (accountLink.length)
                brandName = accountLink[0].innerText.replace('Hello ', '');
        }
        if (brandName) {
            common.bgMessage({
                action: 'sp.setBrandName',
                entityId: getEntityId(),
                brandName,
            }).catch(ga.mcatch);
        }
    }));
}

function requestKdpIntegration() {
    return common.bgMessage({ action: 'kdp.requestPermission' });
}

function hasKdpIntegration() {
    return common.bgMessage({ action: 'kdp.hasPermission' });
}

function campaignSelectOptions(campaigns) {
    let options = [
        { value: campaigns, label: 'All Campaigns' },
        { value: campaigns.filter(c => isRunning(c)), label: 'All Active Campaigns' }
    ];
    for (const asinGroup of Object.values(_.groupBy(campaigns, 'asin'))) {
        if (!asinGroup[0].asin)
            continue;
        options.push({ value: asinGroup, label: `All Campaigns For "${asinGroup[0].productTitle || '[unknown title]'}" (ASIN ${asinGroup[0].asin})`});
    }
    options = options.concat(...campaigns.filter(c => c.name).map(c => ({ value: [c], label: c.name })));

    return options;
}

function dashboardLink(entityId, campaignId, linkClass) {
    const query = campaignId ? `entityId=${entityId}&ckey=id&cval=${stripPrefix(campaignId)}` : `entityId=${entityId}`;
    return $(`<a class="machete-dashboard-link ${linkClass}" target="_blank" href="https://${constants.hostname}/dashboard/highlights?${query}">
        <span>View on Machete</span>
        <img src="https://${constants.hostname}/static/images/external-link.svg" />
    </a>`);
}

function addDashboardLinks() {
    for (const link of $('a[data-e2e-id]')) {
        if ($(link).attr('data-machete-link'))
            continue;

        try {
            const entityId = getEntityId(link.href);
            const campaignId = getCampaignId(link.href);

            if (entityId && campaignId) {
                $(link).after([dashboardLink(entityId, campaignId, 'dashboard-small')]);
            }
            $(link).attr('data-machete-link', true);
        }
        catch (ex) {
            console.log(`Couldn't discover entityId/campaignId for ${link} (probably expected)`);
        }
    }

    // there should typically only be 1 headline, but just in case...
    const entityId = getEntityId();
    for (const headline of $("[data-e2e-id='headline']")) {
        if ($(headline).attr('data-machete-link'))
            continue;

        try {
            const campaignId = getCampaignId();

            if (entityId && campaignId) {
                $(headline).append(dashboardLink(entityId, campaignId, 'dashboard-headline'));
            }
            $(headline).attr('data-machete-link', true);
        }
        catch (ex) {
            console.log(`Couldn't discover entityId/campaignId for headline`);
        }
    }

    for (const title of $("[data-e2e-id='title']")) {
        if ($(title).attr('data-machete-link'))
            continue;

        $(title).append(dashboardLink(entityId, null, 'dashboard-headline'));
        $(title).attr('data-machete-link', true);
    }
}

module.exports = {
    amsPageInit,
    stripPrefix,
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
    storeAdGroupMetadata,
    updateKeywordStatus,
    updateKeywordBid,
    addKeywords,
    copyKeywordsToCampaigns,
    isRunning,
    startSession,
    calculateKnpIncome,
    requestKdpIntegration,
    hasKdpIntegration,
    campaignSelectOptions,
};
