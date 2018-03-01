const common = require('./common.js');

function getCampaignId(href) {
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

let summaryPromise = null;
function getCampaignSummaries() {
    if (!summaryPromise) {
        summaryPromise = common.bgMessage({ action: 'seller.getSummaries' });
    }
    return summaryPromise;
}

module.exports = {
    getCampaignId,
    getCampaignSummaries,
    getAsin,
};
