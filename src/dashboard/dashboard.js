const $ = require('jquery');
const ga = require('../common/ga.js');
const common = require('../common/common.js');
const constants = require('../common/constants.js');
const spData = require('../common/sp-data');

amsPageInit();

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

    throw new Error('could not discover entityId from ' + href);
}

function getCampaignId(href = window.location.toString()) {
    let campaignId = getQueryArgs(href).campaignId;
    if (campaignId) {
        return spData.stripPrefix(campaignId);
    }

    if (href) {
        const rawId = spData.getUriPathChunk(href, 'campaigns');
        return spData.stripPrefix(rawId);
    }

    campaignId = $('input[name=campaignId]').val();
    if (campaignId)
        return spData.stripPrefix(campaignId);

    throw new Error('could not discover campaignId from ' + href);
}

function amsPageInit() {
    try {
        getEntityId();
    }
    catch (ex) {
        console.warn(ex);
        return false;
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

    return true;
}

function dashboardLink(entityId, campaignId, linkClass) {
    const query = campaignId ? `entityId=${entityId}&ckey=id&cval=${spData.stripPrefix(campaignId)}` : `entityId=${entityId}`;
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
