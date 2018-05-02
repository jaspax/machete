const constants = require('../common/constants.js');
const bg = require('./common.js');

function* dataGather() {
    const ranges = yield* getMissingRanges();
    const domains = bg.getSellerDomains();

    if (!domains || !domains.length)
        throw new Error('no known seller domains');

    for (const domain of domains) {
        for (const range of ranges) {
            const startTimestamp = range.start;
            const endTimestamp = range.end;
            const campaignIds = yield* requestCampaignDataRange({ domain, startTimestamp, endTimestamp });

            yield bg.parallelQueue(campaignIds, function*(campaignId) {
                const adGroupIds = yield* requestAdGroupDataRange({ domain, campaignId, startTimestamp, endTimestamp });

                for (const adGroupId of adGroupIds) {
                    yield* requestAdDataRange({ domain, campaignId, adGroupId, startTimestamp, endTimestamp });
                    yield* requestKeywordDataRange({ domain, campaignId, adGroupId, startTimestamp, endTimestamp });
                }
            });
        }
    }
}

function* requestAllPages(getCurrentPage) {
    const pageSize = 50;
    let currentPage = 0;
    let totalRecords = 0;

    do {
        const data = yield* getCurrentPage(pageSize, currentPage * pageSize);
        if (!data)
            break;

        totalRecords = data.iTotalRecords;
        currentPage++;
    }
    while (currentPage * pageSize < totalRecords);
}

function* requestSellerDataRange({ domain, subRoute, filters, startTimestamp, endTimestamp, dataCallback }) {
    yield* requestAllPages(function*(pageSize, currentRecord) {
        const requestParams = {
            sEcho: 1,
            parentCreationDate: 0,
            iDisplayStart: currentRecord,
            iDisplayLength: pageSize,
            statisticsPeriod: 'CUSTOMIZED',
            aggregates: true,
            startDate: startTimestamp,
            endDate: endTimestamp,
            statusFilter: 'ENABLED',
        };
        if (filters) {
            if (filters.statusFilter) {
                requestParams.statusFilter = filters.statusFilter;
                delete filters.statusFilter;
            }
            requestParams.filters = JSON.stringify(filters);
        }

        const route = `https://${domain}/hz/cm/${subRoute}/fetch`;
        try {
            const data = yield bg.ajax(route, {
                method: 'GET',
                data: requestParams,
                dataType: 'json',
            });

            yield* dataCallback(data);
            return data;
        }
        catch (ex) {
            if (bg.handleServerErrors(ex, `requestSellerDataRange ${route}`))
                return null;
            throw ex;
        }
    });
}

function dataIdsWithImpressions(data) {
    const idIndex = data.columnNames.indexOf('id');
    const impressionsIndex = data.columnNames.indexOf('impressions');
    return data.aaData.filter(x => x[idIndex] && x[impressionsIndex]).map(x => x[idIndex]);
}

function* requestCampaignDataRange({ domain, startTimestamp, endTimestamp }) {
    const campaignIds = new Set();
    console.log('requesting campaign data in range', startTimestamp, endTimestamp);

    yield* requestSellerDataRange({ domain, subRoute: 'campaign', filters: null, startTimestamp, endTimestamp, // eslint-disable-line object-curly-newline,object-property-newline
        dataCallback: function*(data) {
            // We always store campaign data ranges, because that acts as a signal
            // that we've synced data for this range.
            yield* storeCampaignDataRange(data, startTimestamp, endTimestamp);

            // Don't bother doing anything else if nothing happened in this range
            if (!data.aggrStatData.impressions)
                return;

            // Gather the IDs of the campaigns discovered in this data range which
            // have non-zero impressions
            dataIdsWithImpressions(data).forEach(x => campaignIds.add(x));
        }
    });

    return Array.from(campaignIds);
}

function* requestAdGroupDataRange({ domain, campaignId, startTimestamp, endTimestamp }) {
    const adGroupIds = new Set();
    console.log('requesting adGroupData data in range', startTimestamp, endTimestamp, 'campaignId', campaignId);

    const filters = {campaign: { id: { eq: [campaignId] } } };
    yield* requestSellerDataRange({ domain, subRoute: 'adgroup', filters, startTimestamp, endTimestamp, // eslint-disable-line object-curly-newline,object-property-newline
        dataCallback: function*(data) {
            // Don't bother storing if nothing happened in this range
            if (!data.aggrStatData.impressions)
                return;

            yield* storeAdGroupDataRange(data, startTimestamp, endTimestamp);

            // Gather the adGroupIds of the ad groups discovered in this data range
            dataIdsWithImpressions(data).forEach(x => adGroupIds.add(x));
        }
    });

    return Array.from(adGroupIds);
}

function* requestAdDataRange({ domain, campaignId, adGroupId, startTimestamp, endTimestamp }) {
    console.log('requesting ad data in range', startTimestamp, endTimestamp, 'campaignId', campaignId, 'adGroupId', adGroupId);
    const filters = {campaign: { id: { eq: [campaignId] } }, adGroup: { id: { eq: [adGroupId] } } };
    yield* requestSellerDataRange({ domain, subRoute: 'ad', filters, startTimestamp, endTimestamp, // eslint-disable-line object-curly-newline,object-property-newline
        dataCallback: function*(data) {
            // Don't bother storing if nothing happened in this range
            if (!data.aggrStatData.impressions)
                return;

            yield* storeAdDataRange(data, startTimestamp, endTimestamp); 
        }
    });
}

function* requestKeywordDataRange({ domain, campaignId, adGroupId, startTimestamp, endTimestamp }) {
    console.log('requesting keyword data in range', startTimestamp, endTimestamp, 'campaignId', campaignId, 'adGroupId', adGroupId);
    const filters = { 
        statusFilter: 'ENABLED|PAUSED',
        matchType: { eq: ["broad", "phrase", "exact"] }, 
        campaign: { id: { eq: [campaignId] } }, 
        adGroup: { id: { eq: [adGroupId] } } 
    };
    yield* requestSellerDataRange({ domain, subRoute: 'keyword', filters, startTimestamp, endTimestamp, // eslint-disable-line object-curly-newline,object-property-newline
        dataCallback: function*(data) {
            // Don't bother storing if nothing happened in this range
            if (!data.aggrStatData.impressions)
                return;

            yield* storeKeywordDataRange(data, startTimestamp, endTimestamp);
        }
    });
}

function* getMissingRanges() {
    return yield bg.ajax(`https://${constants.hostname}/api/seller/campaignData/missingRanges`, {
        method: 'GET',
        dataType: 'json',
    });
}

const getSummaries = bg.cache.coMemo(function*() {
    return yield bg.ajax(`https://${constants.hostname}/api/seller/summary`, {
        method: 'GET',
        dataType: 'json'
    });
});

function* storeSellerDataRange(subRoute, data, startTimestamp, endTimestamp) {
    return yield bg.ajax(`https://${constants.hostname}/api/seller/${subRoute}/${startTimestamp}-${endTimestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* getSellerDataRange(subRoute, startTimestamp, endTimestamp) {
    return yield bg.ajax(`https://${constants.hostname}/api/seller/${subRoute}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}

function* storeCampaignDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('campaignData', data, startTimestamp, endTimestamp);
}

const getCampaignDataRange = bg.cache.coMemo(function*({ campaignId, startTimestamp, endTimestamp }) {
    return yield* getSellerDataRange(`campaignData/${campaignId}`, startTimestamp, endTimestamp);
});

function* storeAdGroupDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('adGroupData', data, startTimestamp, endTimestamp);
}

const getAdGroupDataRange = bg.cache.coMemo(function*({ campaignId, adGroupId, startTimestamp, endTimestamp }) {
    return yield* getSellerDataRange(`adGroupData/${campaignId}/${adGroupId}`, startTimestamp, endTimestamp);
});

function* storeAdDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('adData', data, startTimestamp, endTimestamp);
}

const getAdDataRange = bg.cache.coMemo(function*({ campaignId, adGroupId, adId, startTimestamp, endTimestamp }) {
    return yield* getSellerDataRange(`adData/${campaignId}/${adGroupId}/ad=${adId}`, startTimestamp, endTimestamp);
});

const getAdDataRangeByAsin = bg.cache.coMemo(function*({ campaignId, adGroupId, asin, startTimestamp, endTimestamp }) {
    return yield* getSellerDataRange(`adData/${campaignId}/${adGroupId}/asin=${asin}`, startTimestamp, endTimestamp);
});

function* storeKeywordDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('keywordData', data, startTimestamp, endTimestamp);
}

const getKeywordDataRange = bg.cache.coMemo(function*({ campaignId, adGroupId, startTimestamp, endTimestamp }) {
    return yield* getSellerDataRange(`keywordData/${campaignId}/${adGroupId}`, startTimestamp, endTimestamp);
});

module.exports = {
    name: 'seller',
    dataGather,
    getSummaries,
    getCampaignDataRange,
    getAdGroupDataRange,
    getAdDataRange,
    getAdDataRangeByAsin,
    getKeywordDataRange,
};
