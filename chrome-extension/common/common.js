/* eslint-disable no-unused-vars */

const prefix = 'machete';
const span = {
    second: 1000,
    minute: 1000 * 60,
    hour: 1000 * 60 * 60,
    day: 1000 * 60 * 60 * 24,
};

function getEntityId() {
    let entityId = getQueryArgs().entityId;
    if (entityId) {
        return entityId;
    }

    let navLink = $('.topNavLogo')[0].href;
    let query = navLink.substring(navLink.indexOf('?') + 1);
    entityId = getQueryArgs(query).entityId;
    if (entityId) {
        return entityId;
    }

    throw merror('could not discover entityId');
}

function getCampaignId() {
    let campaignId = getQueryArgs().campaignId;
    if (campaignId) {
        return campaignId;
    }

    campaignId = $('input[name=campaignId]').val();
    if (campaignId) {
        return campaignId;
    }

    throw merror('could not discover entityId');
}

const chartPng = chrome.runtime.getURL('images/chart-16px.png');

function getQueryArgs(str) {
    let qstring = str || window.location.search.substring(1);
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

if (window.location.href.includes('ams')) {
    chrome.runtime.sendMessage({
        action: 'setSession', 
        entityId: getEntityId(), 
    });

    // Add in the Machete link to the top bar
    chrome.runtime.sendMessage({ action: 'getUser' }, response => {
        if (response.error) {
            merror(response.error);
            return;
        }
        const user = response.data;
        let email = user.email;
        user.isAnon = email == 'anon-user-email';

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
            chunks.splice(-1, 0, `${desc} (<a data-mclick="machete-status ${label}" title="${email}" href="https://machete-app.com/profile" target="_blank">${profileText}</a>)`);
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

        window.user = user;
    });
}

// Convert a series of timestamped structs into an object with one or more
// parallel arrays. The arrays which are built are based on opt.metric or
// opt.metrics (if more than one), and you can get raw values, or the rate of
// change from the previous value if opt.rate is set.
function parallelizeHistoryData(data, opt) {
    let metrics = opt.metrics || [opt.metric];
    let c = { timestamps: [] };
    metrics.forEach(metric => c[metric] = []);

    let lastItem = null;
    data = data.sort((a, b) => a.timestamp - b.timestamp);
    for (let item of data) {
        // Don't modify the original items in the data array!
        item = Object.assign({}, item);

        if (opt.chunk) {
            // Round off all time values to their nearest chunk
            item.timestamp -= item.timestamp % span[opt.chunk];

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
            if (!opt.rate) {
                c[metric].push(item[metric]);
                continue;
            }

            if (lastItem) {
                let rateFactor = (item.timestamp - lastItem.timestamp)/span[opt.rate];
                let normalized = (item[metric] - lastItem[metric])/rateFactor;
                if (opt.round)
                    normalized = Math.round(normalized);
                c[metric].push(normalized);
            }
        }

        lastItem = item;
    }

    return c;
}
