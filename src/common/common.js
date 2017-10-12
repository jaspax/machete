/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const qw = require('qw');
const ga = require('./ga.js');
const constants = require('./constants.js');
const moment = require('moment');

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

function getSellerCampaignId(href) {
    let path = href.split('?')[0];
    let parts = path.split('/');
    let campaignIdx = parts.indexOf('campaign');
    let adGroupIdx = parts.indexOf('ad_group');
    return { 
        campaignId: campaignIdx >= 0 ? parts[campaignIdx + 1] : null,
        adGroupId: adGroupIdx >= 0 ? parts[adGroupIdx + 1] : null,
    };
}

function getAsin(url) {
    let path = url.split('?')[0];
    let parts = path.split('/');

    // ASIN is 10 characters beginning with B. If there's only one of those,
    // return it immediately.
    let asinLookalikes = parts.filter(x => x.length == 10 && x[0] == 'B');
    if (!asinLookalikes.length)
        return null;
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
    return '$' + numberFmt(val, 2);
}

function pctFmt(val) {
    return numberFmt(val, 1) + '%';
}

function numberFmt(val, digits) {
    if (Number.isNaN(+val)) {
        return ' -- ';
    }
    return (+val).toFixed(2);
}

function roundFmt(val) {
    if (Number.isNaN(+val)) {
        return ' -- ';
    }
    return Math.round(val);
}

function bgMessage(opts) {
    return ga.mpromise((resolve, reject) => {
        chrome.runtime.sendMessage(opts, response => {
            if (response.error)
                return reject(response.error);
            return resolve(response.data);
        });
    });
}

const cumulativeMetrics = qw`impressions clicks salesCount salesValue spend`;
const cumulativeKeywordMetrics = qw`impressions clicks sales spend`;
const aggregateMetrics = qw`ctr acos avgCpc`;

const round = {
    whole: Math.round,
    money: x => Math.round(x * 100)/100,
};

const roundMetrics = {
    impressions: round.whole,
    clicks: round.whole,
    salesCount: round.whole,
    salesValue: round.money,
    spend: round.money,
};

// Convert a series of objects into a single object with a number of parallel
// arrays. All objects in the series should have the same keys; in any case,
// only the keys from the first object in the series are respected.
function parallelizeSeries(data) {
    let c = { timestamp: [], data: [] };
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
function convertSnapshotsToDeltas(data, opt) {
    let c = [];
    opt = opt || {};

    let lastItem = null;
    data = data.sort((a, b) => a.timestamp - b.timestamp);
    for (let item of data) {
        if (opt.chunk) {
            if (lastItem && moment(item.timestamp).isSame(moment(lastItem.timestamp), opt.chunk)) {
                continue;
            }
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
            const delta = Object.assign({}, item);
            if (opt.chunk) {
                delta.timestamp = moment(item.timestamp).startOf(opt.chunk).valueOf();
            }
            for (let metric of cumulativeMetrics) {
                let rateFactor = (item.timestamp - lastItem.timestamp)/constants.timespan[opt.rate];
                let normalized = (item[metric] - lastItem[metric])/rateFactor;
                normalized = (roundMetrics[metric] || (x => x))(normalized);
                delta[metric] = normalized;
            }
            c.push(delta);
        }

        lastItem = item;
    }

    return c;
}

function aggregateSeries(series, opt) {
    const a = {};
    for (const s of series) {
        for (const item of s) {
            const timestamp = moment(item.timestamp).startOf(opt.chunk).valueOf();
            if (a[timestamp]) {
                for (const key of cumulativeMetrics) {
                    a[timestamp][key] = item[key] + (a[timestamp][key] || 0);
                }
            }
            else {
                a[timestamp] = item;
            }
        }
    }

    return _.keys(a).sort().map(x => a[x]);
}

function aggregateKeywords(kwSets, opt) {
    // Aggregate the cumulative metrics
    const a = {};
    for (const kws of kwSets) {
        for (const item of kws) {
            const kw = item.keyword;
            if (a[kw]) {
                for (const key of cumulativeKeywordMetrics) {
                    a[kw][key] = item[key] + (a[kw][key] || 0);
                }
                a[kw].id.push(item.id);
                a[kw].bid = Math.max(a[kw].bid, item.bid);
                a[kw].enabled = a[kw].enabled || item.enabled;
            }
            else {
                a[kw] = item;
                a[kw].id = [item.id];
            }
        }
    }

    // Recalculate the aggregate metrics
    const keywords = _.keys(a).map(x => a[x]);
    for (const kw of keywords) {
        kw.acos = kw.sales ? 100 * (kw.spend / kw.sales) : null;
        kw.avgCpc = kw.spend / kw.clicks;
        kw.ctr = kw.impressions ? 100 * (kw.clicks / kw.impressions) : null;
    }

    return keywords;
}


let campaignPromise = {};
function getCampaignHistory(entityId, campaignId) {
    if (!campaignPromise[campaignId]) {
        campaignPromise[campaignId] = bgMessage({
            action: 'getDataHistory',
            entityId: entityId,
            campaignId: campaignId,
        });
    }
    return campaignPromise[campaignId];
}

let keywordPromise = {};
function getKeywordData(entityId, adGroupId) {
    if (!keywordPromise[adGroupId]) {
        keywordPromise[adGroupId] = bgMessage({
            action: 'getKeywordData',
            entityId,
            adGroupId,
        });
    }
    return keywordPromise[adGroupId];
}

let allowedPromise = null;
function getAllCampaignsAllowed(entityId) {
    if (!allowedPromise) {
        allowedPromise = bgMessage({
            action: 'getAllowedCampaigns', 
            entityId
        });
    }
    return allowedPromise;
}

function getCampaignAllowed(entityId, campaignId) {
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
function getCampaignSummaries(entityId) {
    if (!summaryPromise) {
        summaryPromise = bgMessage({
            action: 'getCampaignSummaries',
            entityId: entityId,
        });
    }
    return summaryPromise;
}

let getUserPromise = null;
function getUser() {
    if (!getUserPromise) {
        getUserPromise = ga.mpromise(resolve => {
            chrome.runtime.sendMessage({ action: 'getUser' }, response => {
                if (response.error && !response.error.handled) {
                    ga.merror(response.error);
                }
                const user = response.data || { email: 'anon-user-email', activeSubscription: { id: 'free', name: 'Machete Free' } };
                user.isAnon = user.email == 'anon-user-email';
                resolve(user);
            });
        });
    }
    return getUserPromise;
}

if (window.location.href.includes('ams')) {
    bgMessage({
        action: 'setSession', 
        entityId: getEntityId(), 
    })
    .then(() => console.info('setSession success'))
    .catch(() => console.warn('setSession failure'));

    getUser().then(ga.mcatch(user => {
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
}

function updateKeyword(keywordIdList, operation, dataValues) {
    return bgMessage({
        action: 'updateKeyword',
        entityId: getEntityId(),
        keywordIdList,
        operation,
        dataValues,
    })
    .then(() => ({success: true}));
}

function updateKeywordStatus(keywordIdList, enable) {
    let operation = enable ? "ENABLE" : "PAUSE";
    return updateKeyword(keywordIdList, operation, {});
}

function updateKeywordBid(keywordIdList, bid) {
    bid = parseFloat(bid).toFixed(2).toString();
    return updateKeyword(keywordIdList, 'UPDATE', {bid});
}

module.exports = {
    getEntityId,
    getCampaignId,
    getSellerCampaignId,
    getQueryArgs,
    getAsin,
    getCampaignAllowed,
    getAllCampaignsAllowed,
    getCampaignSummaries,
    getUser,
    moneyFmt,
    pctFmt,
    numberFmt,
    roundFmt,
    bgMessage,
    getCampaignHistory,
    getKeywordData,
    parallelizeSeries,
    convertSnapshotsToDeltas,
    aggregateSeries,
    aggregateKeywords,
    updateKeywordStatus,
    updateKeywordBid,
};
