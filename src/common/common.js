/* eslint-disable no-unused-vars */
const $ = require('jquery');
const _ = require('lodash');
const qw = require('qw');
const ga = require('./ga.js');
const constants = require('./constants.js');
const moment = require('moment');

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

    const agg = _.keys(a).sort().map(x => a[x]);
    for (const item of agg) {
        item.acos = item.salesValue ? 100 * (item.spend / item.salesValue) : null;
        item.avgCpc = item.spend / item.clicks;
        item.ctr = item.impressions ? 100 * (item.clicks / item.impressions) : null;
    }

    return agg;
}

function aggregateKeywords(kwSets) {
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

function accumulateKeywordSeries(data) {
    const keywords = {};
    for (const record of data.sort((a, b) => a.timestamp - b.timestamp)) {
        const kw = record.keyword;
        if (!keywords[kw])
            keywords[kw] = {};
        _.each(_.keys(record), key => {
            if (cumulativeKeywordMetrics.includes(key)) {
                if (isNaN(keywords[kw][key]))
                    keywords[kw][key] = 0;
                keywords[kw][key] += record[key];
            }
            else {
                keywords[kw][key] = record[key];
            }
        });
    }

    const values = _.values(keywords);
    for (const kw of values) {
        kw.acos = kw.sales ? 100 * kw.spend/kw.sales : null;
        kw.ctr = kw.impressions ? 100* kw.clicks/kw.impressions : null;
        kw.avgCpc = kw.clicks ? kw.spend/kw.clicks : null;
    }

    return values;
}

let sellerSummaryPromise = null;
function getSellerCampaignSummaries(entityId) {
    if (!sellerSummaryPromise) {
        sellerSummaryPromise = bgMessage({ action: 'getSummaries' });
    }
    return sellerSummaryPromise;
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

module.exports = {
    getSellerCampaignId,
    getAsin,
    getSellerCampaignSummaries,
    getUser,
    moneyFmt,
    pctFmt,
    numberFmt,
    roundFmt,
    bgMessage,
    parallelizeSeries,
    convertSnapshotsToDeltas,
    aggregateSeries,
    aggregateKeywords,
    accumulateKeywordSeries,
};
