/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const qw = require('qw');
const ga = require('./ga.js');
const constants = require('./constants.gen.js');

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

    throw ga.merror('could not discover entityId');
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

    throw ga.merror('could not discover entityId');
}

function getSellerCampaignId(href) {
    let path = href.split('?')[0];
    let parts = path.split('/');
    let campaignIdx = parts.indexOf('campaign');
    let adGroupIdx = parts.indexOf('ad_group');
    return { 
        campaignId: campaignIdx >= 0 ? parts[campaignIdx + 1] : undefined,
        adGroupId: adGroupIdx >= 0 ? parts[adGroupIdx + 1] : undefined,
    };
}

function getAsin(url) {
    let path = url.split('?')[0];
    let parts = path.split('/');

    // ASIN is 10 characters beginning with B. If there's only one of those,
    // return it immediately.
    let asinLookalikes = parts.filter(x => x.length == 10 && x[0] == 'B');
    if (!asinLookalikes.length)
        return undefined;
    if (asinLookalikes.length == 1)
        return asinLookalikes[0];

    // Look for url patterns like product/${ASIN}
    let productIdx = parts.indexOf('product');
    if (productIdx >= 0 && asinLookalikes.includes(parts[productIdx + 1]))
        return parts[productIdx + 1];

    // Look for url patterns like dp/${ASIN}
    let dpIdx = parts.indexOf('dp');
    if (dpIdx >= 0 && asinLookalikes.includes(parts[dpIdx + 1]))
        return parts[dpIdx + 1];

    // Just return the first ASIN-like thing and hope for the best. This returns
    // undefined if there were *no* ASINs found.
    return asinLookalikes[0];
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

function moneyFmt(val) {
    if (Number.isNaN(+val)) {
        return '--';
    }
    return `$${(+val).toFixed(2)}`;
}

function pctFmt(val) {
    if (Number.isNaN(+val)) {
        return '--';
    }
    return `${(+val).toFixed(2)}%`;
}

const cumulativeMetrics = qw`impressions clicks salesCount salesValue spend`;
const aggregateMetrics = qw`ctr acos avgCpc`;

// Convert a series of objects into a single object with a number of parallel
// arrays. All objects in the series should have the same keys; in any case,
// only the keys from the first object in the series are respected.
function parallelizeSeries(data) {
    let c = { timestamp: [] };
    if (!data || !data.length)
        return c;

    _.keys(data[0]).forEach(key => c[key] = []);

    for (let item of data) {
        for (let key of _.keys(c)) {
            if (key == 'timestamp')
                c[key].push(new Date(item[key]));
            else
                c[key].push(item[key]);
        }
    }

    return c;
}

// Convert a series of timestamped snapshots into a series of objects in which
// each key has the difference from the previous snapshot, ie. the rate of
// change between snapshots. Only the metrics found in `cumulativeMetrics` are
// converted into rates. The opt object has the following relevant keys:
//      chunk: round timestamps off to the nearest hour/day/etc. and only
//          compare values that cross a chunk boundary.
//      rate: the timespn over which to calculate rates. Should generally be the
//          same as chunk, when present.
//      startTimestamp: earliest timestamp to examine. Items outside of this
//          range are discarded.
//      endTimestamp: latest timestamp to examine. Items outside of this range
//          are discarded.
//      round: if true, then fractional values are rounded to the nearest whole
//          value
function convertSnapshotsToDeltas(data, opt) {
    let c = [];
    opt = opt || {};

    let lastItem = null;
    data = data.sort((a, b) => a.timestamp - b.timestamp);
    for (let item of data) {
        // Don't modify the original items in the data array!
        item = Object.assign({}, item);

        if (opt.chunk) {
            // Round off all time values to their nearest chunk and skip values
            // within the same chunk
            item.timestamp -= item.timestamp % constants.timespan[opt.chunk];
            if (lastItem && !(item.timestamp - lastItem.timestamp))
                continue;
        }

        // Filter out things by date range
        if (opt.startTimestamp && item.timestamp < opt.startTimestamp) {
            continue;
        }
        if (opt.endTimestamp && item.timestamp > opt.endTimestamp) {
            continue;
        }

        // Skip this data point unless one of our metrics actually changed.
        if (lastItem && !cumulativeMetrics.some(metric => item[metric] != lastItem[metric])) {
            continue;
        }

        if (lastItem) {
            for (let metric of cumulativeMetrics) {
                let rateFactor = (item.timestamp - lastItem.timestamp)/constants.timespan[opt.rate];
                let normalized = (item[metric] - lastItem[metric])/rateFactor;
                if (opt.round)
                    normalized = Math.round(normalized);
                item[metric] = normalized;
            }
            c.push(item);
        }

        lastItem = item;
    }

    return c;
}

function getCampaignHistory(entityId, campaignId, cb) {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: entityId,
        campaignId: campaignId,
    },
    ga.mcatch(response => {
        if (response.error) {
            ga.merror(response.status, response.error);
            return;
        }
        cb(response.data);
    }));
}

if (window.location.href.includes('ams')) {
    chrome.runtime.sendMessage({
        action: 'setSession', 
        entityId: getEntityId(), 
    }, response => {});

    // Add in the Machete link to the top bar
    chrome.runtime.sendMessage({ action: 'getUser' }, response => {
        if (response.error) {
            ga.merror(response.error);
            return;
        }
        const user = response.data;
        let email = user.email;
        user.isAnon = email == 'anon-user-email';
        window.user = user;

        const desc = user.activeSubscription.name;
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

    });
}

if (window.location.href.includes('sellercentral')) {
    chrome.runtime.sendMessage({ action: 'setSession', }, response => {});

    // Add in the Machete link to the top bar
    chrome.runtime.sendMessage({ action: 'getUser' }, response => {
        if (response.error) {
            ga.merror(response.error);
            return;
        }
        const user = response.data;
        let email = user.email;
        user.isAnon = email == 'anon-user-email';
        window.user = user;
    });
}

module.exports = {
    getEntityId,
    getCampaignId,
    getSellerCampaignId,
    getQueryArgs,
    getAsin,
    moneyFmt,
    pctFmt,
    getCampaignHistory,
    parallelizeSeries,
    convertSnapshotsToDeltas,
};
