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

function timestampSort(a, b) {
    return a.timestamp - b.timestamp;
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

function renormKeywordStats(kws) {
    // Get the total impressions, sales, etc. for the thing
    const totalImpressions = _.sumBy(kws, kw => kw.impressions);
    const totalClicks = _.sumBy(kws, kw => kw.clicks);
    const totalSales = _.sumBy(kws, kw => kw.sales);
    const totalSpend = _.sumBy(kws, kw => kw.spend);

    const avgImpressions = totalImpressions / kws.length;
    const avgClicks = totalClicks / kws.length;
    const avgSales = totalSales / kws.length;
    const avgSpend = totalSpend / kws.length;

    // We add 10% to maxImpressions to avoid over-fitting to whatever keyword
    // happens to have the most impressions. This number is a good target for
    // optimization.
    const maxImpressions = Math.max(...kws.map(x => x.impressions));

    return kws.map(kw => {
        const x = Object.assign({}, kw);
        const selfNormRatio = Math.sqrt(x.impressions / maxImpressions);
        const avgNormRatio = 1 - selfNormRatio;

        x.impressions = (x.impressions * selfNormRatio) + (avgImpressions * avgNormRatio);
        x.clicks = (x.clicks * selfNormRatio) + (avgClicks * avgNormRatio);
        x.sales = (x.sales * selfNormRatio) + (avgSales * avgNormRatio);
        x.spend = (x.spend * selfNormRatio) + (avgSpend * avgNormRatio);
        calculateItemStats(x);

        return x;
    });
}

function optimizeKeywordsAcos(targetAcos, kws) {
    return kws.map(x => {
        const kw = Object.assign({}, x);
        kw.bid *= targetAcos / kw.acos;
        return kw;
    });
}

function optimizeKeywordsSalesPerDay(targetSalesPerDay, campaign, campaignSummary, kws) {
    const now = moment();
    const campaignDays = now.diff(campaignSummary.startDate, 'days');
    const campaignSalesPerDay = campaign.salesValue / campaignDays;
    const campaignSalesPerClick = campaign.salesValue / campaign.clicks;
    let ratio = targetSalesPerDay / campaignSalesPerDay;

    if (campaignSummary.budgetType == 'DAILY') {
        const targetSpendPerDay = campaignSummary.budget;
        const campaignSpendPerDay = campaign.spend / campaignDays;
        const spendRatio = targetSpendPerDay / campaignSpendPerDay;
        if (spendRatio < ratio)
            ratio = spendRatio;
    }

    return kws.map(x => {
        const kw = Object.assign({}, x);
        const kwSalesPerClick = kw.sales / kw.clicks;
        kw.bid = ratio * kw.avgCpc * (kwSalesPerClick / campaignSalesPerClick);
        return kw;
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

        // Sanity check
        if (lastOrigItem && origItem.timestamp < lastOrigItem.timestamp) {
            throw new Error('arrays passed to chunkSeries must be sorted by timestamp');
        }

        if (!lastItem) {
            lastItem = item;
        }
        else if (item.timestamp == lastItem.timestamp) {
            for (const metric of cumulativeMetrics) {
                lastItem[metric] += item[metric] || 0;
            }
        }
        else {
            if (origItem.timestamp != item.timestamp) {
                // When crossing a chunk boundary with irregularly spaced data,
                // calculate the portion of the time diff that lies within the
                // chunk we're entering and the chunk we're leaving, and then
                // credit each item with the proper proportion of the change
                const span = origItem.timestamp - lastOrigItem.timestamp;
                const thisChunkRatio = (origItem.timestamp - item.timestamp) / span;
                const lastChunkRatio = (moment(lastItem.timestamp).endOf(chunk).valueOf() - lastOrigItem.timestamp) / span;
                for (const metric of cumulativeMetrics) {
                    lastItem[metric] += roundMetrics[metric](item[metric] * lastChunkRatio);
                    item[metric] = roundMetrics[metric](item[metric] * thisChunkRatio);
                }
            }

            calculateItemStats(lastItem);
            c.push(lastItem);
            lastItem = item;
        }

        lastOrigItem = origItem;
    }

    if (lastItem) {
        calculateItemStats(lastItem);
        c.push(lastItem);
    }

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
    data = data.sort(timestampSort);
    for (let item of data) {
        // Filter out things by date range
        if (opt.startTimestamp && item.timestamp < opt.startTimestamp) {
            continue;
        }
        if (opt.endTimestamp && item.timestamp > opt.endTimestamp) {
            continue;
        }

        if (lastItem) {
            // identical timestamps are probably server-side duplicates
            if (item.timestamp == lastItem.timestamp)
                continue;

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

function aggregateSeries(series, opt = { chunk: 'day' }) {
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
                a[timestamp] = Object.assign({}, item);
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

function accumulateCampaignSeries(data) {
    const accum = {};
    for (const record of data.sort(timestampSort)) {
        for (const key of Object.keys(record)) {
            if (cumulativeMetrics.includes(key)) {
                if (isNaN(accum[key]))
                    accum[key] = 0;
                accum[key] += record[key];
            }
            else {
                accum[key] = record[key];
            }
        }
    }

    calculateItemStats(accum);
    return accum;
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
    values.forEach(calculateItemStats);

    return values;
}

function formatParallelData(data, metric, name = metric) {
    return {
        timestamp: data.timestamp || [],
        data: data[metric] || [],
        format: formatMetric[metric] || roundFmt,
        name
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
    timestampSort,
    bgMessage,
    parallelizeSeries,
    chunkSeries,
    convertSnapshotsToDeltas,
    aggregateSeries,
    aggregateKeywords,
    accumulateKeywordSeries,
    accumulateCampaignSeries,
    formatParallelData,
    renormKeywordStats,
    optimizeKeywordsAcos,
    optimizeKeywordsSalesPerDay,
};
