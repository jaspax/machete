const $ = require('jquery');
const ga = require('../common/ga.js');
const spData = require('../common/sp-data');

amsPageInit();

function getQueryArgs(str = window.location.toString()) {
    let qstring = str || window.location.toString();
    const qmark = qstring.indexOf('?');
    if (qmark < 0)
        return {};

    qstring = qstring.substring(qmark + 1);
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
    return true;
}

function dashboardLink(entityId, campaignId, linkClass) {
    const entity = entityId ? `entityId=${entityId}` : '';
    const query = campaignId ? `${entity}&ckey=id&cval=${spData.stripPrefix(campaignId)}` : entity;
    return $(`<a class="machete-dashboard-link ${linkClass}" target="_blank" href="https://${process.env.HOSTNAME}/dashboard/highlights?${query}">
        <span>View on Machete</span>
        <img src="https://${process.env.HOSTNAME}/static/images/external-link.svg" />
    </a>`);
}

function addDashboardLinks() {
    try {
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
        let entityId = null;
        try {
            entityId = getEntityId();
        }
        catch (ex) {
            ga.merror(ex);
        }

        let headlines = Array.from($("[data-e2e-id='headline']"));
        headlines = headlines.concat(...Array.from($("[data-e2e-id='aac-page-name']")));
        for (const headline of headlines) {
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
    catch (ex) {
        ga.merror(ex);
    }
}
