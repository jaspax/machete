'use strict';

const prefix = 'ams-unlocked';
const span = {
    second: 1000,
    minute: 1000 * 60,
    hour:   1000 * 60 * 60,
    day:    1000 * 60 * 60 * 24,
};

const getEntityId = () => getQueryArgs()['entityId'];
const getCampaignId = () => getQueryArgs()['campaignId'];
const unlockSvg = chrome.runtime.getURL('images/unlock.svg');
const chartPng = chrome.runtime.getURL('images/chart-16px.png');

function getQueryArgs() {
    let qstring = window.location.search.substring(1);
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

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
    cookies: document.cookie,
});

// Convert a series of timestamped structs into an object with one or more
// parallel arrays. The arrays which are built are based on opt.metric or
// opt.metrics (if more than one), and you can get raw values, or the rate of
// change from the previous value if opt.rate is set.
function parallelizeHistoryData(data, opt) {
    let metrics = opt.metrics || [opt.metric];
    let c = { timestamps: [] };
    metrics.forEach(metric => c[metric] = []);

    let lastItem;
    data = data.sort((a, b) => a.timestamp - b.timestamp);
    for (let item of data) {
        // Don't modify the original items in the data array!
        item = Object.assign({}, item);

        if (opt.chunk) {
            // Round off all time values to their nearest chunk
            item.timestamp = item.timestamp - (item.timestamp % span[opt.chunk]);

            if (lastItem && !(item.timestamp - lastItem.timestamp))
                continue;
        }

        // Skip this data point unless one of our metrics actually increased.
        // (It's possible for frequently-sampled data to occasionally go down,
        // even though logically that's impossible, due to weirdness in Amazon's
        // backend.)
        if (lastItem && !metrics.some(metric => item[metric] > lastItem[metric])) {
            continue;
        }

        // When using opt.rate, the first entry doesn't generate a data point,
        // so no timestamp or else our arrays get off
        if (!opt.rate || lastItem) {
            c.timestamps.push(new Date(item.timestamp).toISOString());
        }

        for (let metric of metrics) {
            if (opt.rate) {
                if (lastItem) {
                    let rateFactor = (item.timestamp - lastItem.timestamp)/span[opt.rate];
                    let normalized = (item[metric] - lastItem[metric])/rateFactor;
                    if (opt.round)
                        normalized = Math.round(normalized);
                    c[metric].push(normalized);
                }
            }
            else {
                c[metric].push(item[metric]);
            }
        }

        lastItem = item;
    }

    return c;
}
