const _ = require('lodash');
const qw = require('qw');
const ga = require('./ga.js');
const moment = require('moment');

const cumulativeMetrics = qw`impressions clicks salesCount salesValue spend`;
const cumulativeKeywordMetrics = qw`impressions clicks sales spend`;

function moneyFmt(val) {
    return '$' + numberFmt(val, 2);
}

function pctFmt(val) {
    return numberFmt(val, 1) + '%';
}

function numberFmt(val, digits = 2) {
    if (Number.isNaN(+val)) {
        return ' -- ';
    }
    return (+val).toFixed(digits);
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

const round = {
    whole: Math.round,
    money: x => Math.round(x * 100)/100,
};

const roundMetrics = {
    impressions: round.whole,
    clicks: round.whole,
    sales: round.money,
    salesCount: round.whole,
    salesValue: round.money,
    spend: round.money,
};

const formatMetric = {
    impressions: roundFmt,
    clicks: roundFmt,
    sales: moneyFmt,
    salesCount: roundFmt,
    salesValue: moneyFmt,
    spend: moneyFmt,
    acos: pctFmt,
    avgCpc: moneyFmt,
    ctr: pctFmt,
};

// Calculate the statistical measures for a delta at a particular time
function calculateItemStats(item) {
    const sales = item.salesValue || item.sales; // salesValue for campaigns, sales for keywords
    item.acos = sales ? 100 * (item.spend / sales) : null;
    item.avgCpc = item.spend / item.clicks;
    item.ctr = item.impressions ? 100 * (item.clicks / item.impressions) : null;
    return item;
}

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

// Convert a series of irregularly spaced deltas into a series of evenly-spaced
// deltas with the spacing given by 'chunk'. Chunk may be any timespan value
// recognized by moment.js.
function chunkSeries(data, chunk) {
    if (!chunk)
        throw new Error("parameter 'chunk' is required");

    let c = [];
    let lastItem = null;
    let lastOrigItem = null;
    for (const origItem of data) {
        const item = Object.assign({}, origItem);
        item.timestamp = moment(item.timestamp).startOf(chunk).valueOf();

        if (!lastItem) {
            lastItem = item;
        }
        else if (item.timestamp == lastItem.timestamp) {
            for (const metric of cumulativeMetrics) {
                lastItem[metric] += item[metric] || 0;
            }
        }
        else {
            // When crossing a chunk boundary, calculate the portion of the time
            // diff that lies within the chunk we're entering and the chunk
            // we're leaving, and then credit each item with the proper
            // proportion of the metric change
            const span = origItem.timestamp - lastOrigItem.timestamp;
            const thisChunkRatio = (origItem.timestamp - item.timestamp) / span;
            const lastChunkRatio = (moment(lastItem.timestamp).endOf(chunk).valueOf() - lastOrigItem.timestamp) / span;
            for (const metric of cumulativeMetrics) {
                lastItem[metric] += roundMetrics[metric](item[metric] * lastChunkRatio);
                item[metric] = roundMetrics[metric](item[metric] * thisChunkRatio);
            }

            calculateItemStats(lastItem);
            c.push(lastItem);
            lastItem = item;
        }
        lastOrigItem = origItem;
    }
    calculateItemStats(lastItem);
    c.push(lastItem);
    return c;
}

// Convert a series of timestamped snapshots into a series of objects in which
// each key has the difference from the previous snapshot, ie. the rate of
// change between snapshots. Only the metrics found in `cumulativeMetrics` are
// converted into rates. The opt object has the following relevant keys:
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
        // Filter out things by date range
        if (opt.startTimestamp && item.timestamp < opt.startTimestamp) {
            continue;
        }
        if (opt.endTimestamp && item.timestamp > opt.endTimestamp) {
            continue;
        }

        if (lastItem) {
            // Skip this point if any metric decreased
            if (cumulativeMetrics.some(metric => item[metric] < lastItem[metric]))
                continue;

            const delta = Object.assign({}, item);
            for (let metric of cumulativeMetrics) {
                delta[metric] = item[metric] - lastItem[metric];
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
    agg.forEach(calculateItemStats);
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
    keywords.forEach(calculateItemStats);
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

function formatParallelData(data, name) {
    return {
        timestamp: data.timestamp || [],
        data: data[name] || [],
        format: formatMetric[name] || roundFmt,
        name,
    };
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
    getUser,
    moneyFmt,
    pctFmt,
    numberFmt,
    roundFmt,
    bgMessage,
    parallelizeSeries,
    chunkSeries,
    convertSnapshotsToDeltas,
    aggregateSeries,
    aggregateKeywords,
    accumulateKeywordSeries,
    formatParallelData,
};
