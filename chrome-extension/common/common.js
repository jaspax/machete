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

function parallelizeHistoryData(data, opt) {
    // We have a series of timestamped snapshots; we want a series of parallel
    // arrays keyed by campaignId
    let c = {
        timestamps: [],
    };
    opt.metrics.forEach(metric => c[metric] = []);
    let lastItem;
    for (let item of data) {
        // Ignore two consecutive items with the same impressions as noise
        if (lastItem && lastItem.impressions >= item.impressions) {
                continue;
        }

        // When using opt.rate, the first entry doesn't generate an entry, so no
        // timestamp or else our arrays get off
        if (!opt.rate || lastItem) {
            c.timestamps.push(new Date(item.timestamp).toISOString());
        }

        for (let metric of opt.metrics) {
            if (opt.rate) {
                if (lastItem) {
                    let timeDiff = item.timestamp - lastItem.timestamp;
                    let denom = timeDiff/span[opt.rate];
                    c[metric].push((item[metric] - lastItem[metric])/denom);
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
