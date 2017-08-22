const $ = require('jquery');
const constants = require('../common/constants.gen.js');
const bg = require('../common/common-background.js');

bg.messageListener(function*(req) {
    if (req.action == 'setSession')
        return yield* setSession(req);
    if (req.action == 'getUser')
        return yield* bg.getUser();
    if (req.action == 'getCampaignDataRange')
        return yield* getCampaignDataRange(req.campaignId, req.startTimestamp, req.endTimestamp);
    if (req.action == 'getAdGroupDataRange')
        return yield* getAdGroupDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);
    if (req.action == 'getAdDataRangeByAsin')
        return yield* getAdDataRangeByAsin(req.campaignId, req.adGroupId, req.asin, req.startTimestamp, req.endTimestamp);
    if (req.action == 'getKeywordDataRange')
        return yield* getKeywordDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);
    throw new Error('unknown action');
});

function* synchronizeCampaignData() {
    console.log('synchronizeCampaignData start at', new Date());

    try {
        const ranges = yield* getMissingRanges();
        for (const range of ranges) {
            const campaignIds = yield* requestCampaignDataRange(range.start, range.end);
            const adGroupIds = yield* requestAdGroupDataRange(campaignIds, range.start, range.end);
            yield* requestAdDataRange(campaignIds, adGroupIds, range.start, range.end);
            yield* requestKeywordDataRange(campaignIds, adGroupIds, range.start, range.end);
        }
    }
    catch (ex) {
        /* TURN THIS BACK ON SHORTLY
        if (ex.status == 401) { // Unauthorized
            notifyNeedCredentials();
        } */
        throw ex;
    }
    finally {
        console.log('synchronizeCampaignData finish at', new Date());
    }
}

function* setSession() {
    yield* synchronizeCampaignData();
}

function* requestAllPages(getCurrentPage) {
    const pageSize = 50;
    let currentPage = 0;
    let totalRecords = 0;
    let data = null;

    do {
        data = yield* getCurrentPage(pageSize, currentPage * pageSize);
        totalRecords = data.iTotalRecords;
        currentPage++;
    }
    while (currentPage * pageSize < totalRecords);

    return data;
}

function* requestSellerDataRange(subRoute, filters, startTimestamp, endTimestamp, dataCallback) {
    return yield* requestAllPages(function*(pageSize, currentRecord) {
        const requestParams = {
            sEcho: 1,
            parentCreationDate: 0,
            iDisplayStart: currentRecord,
            iDisplayLength: pageSize,
            statisticsPeriod: 'CUSTOMIZED',
            startTimestamp,
            endTimestamp,
            aggregates: false,
            statusFilter: 'ENABLED'
        };
        if (filters) {
            requestParams.filters = JSON.stringify(filters);
        }

        const data = yield $.ajax(`https://sellercentral.amazon.com/hz/cm/${subRoute}/fetch`, {
            method: 'GET',
            data: requestParams,
            dataType: 'json',
        });

        yield* dataCallback(data);
        return data;
    });
}

function* requestCampaignDataRange(startTimestamp, endTimestamp) {
    const campaignIds = new Set();
    console.log('requesting campaign data in range', startTimestamp, endTimestamp);

    yield* requestSellerDataRange('campaign', null, startTimestamp, endTimestamp, function*(data) {
        yield* storeCampaignDataRange(data, startTimestamp, endTimestamp);

        // Gather the IDs of the campaigns discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && campaignIds.add(x[idIndex]));
    });

    return Array.from(campaignIds);
}

function* requestAdGroupDataRange(campaignIds, startTimestamp, endTimestamp) {
    const adGroupIds = new Set();
    console.log('requesting adGroupData data in range', startTimestamp, endTimestamp, 'campaignIds', campaignIds);

    const filters = {campaign: { id: { eq: campaignIds } } };
    yield* requestSellerDataRange('adgroup', filters, startTimestamp, endTimestamp, function*(data) {
        yield* storeAdGroupDataRange(data, startTimestamp, endTimestamp);

        // Gather the adGroupIds of the ad groups discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && adGroupIds.add(x[idIndex]));
    });

    return Array.from(adGroupIds);
}

function* requestAdDataRange(campaignIds, adGroupIds, startTimestamp, endTimestamp) {
    console.log('requesting ad data in range', startTimestamp, endTimestamp, 'campaignIds', campaignIds, 'adGroupIds', adGroupIds);
    const filters = {campaign: { id: { eq: campaignIds } }, adGroup: { id: { eq: adGroupIds } } };
    return yield* requestSellerDataRange('ad', filters, startTimestamp, endTimestamp, function*(data) { 
        yield* storeAdDataRange(data, startTimestamp, endTimestamp); 
    });
}

function* requestKeywordDataRange(campaignIds, adGroupIds, startTimestamp, endTimestamp) {
    console.log('requesting keyword data in range', startTimestamp, endTimestamp, 'campaignIds', campaignIds, 'adGroupIds', adGroupIds);
    const filters = { matchType: { eq: ["broad", "phrase", "exact"] }, campaign: { id: { eq: campaignIds } }, adGroup: { id: { eq: adGroupIds } } };
    return yield* requestSellerDataRange('keyword', filters, startTimestamp, endTimestamp, function*(data) {
        yield* storeKeywordDataRange(data, startTimestamp, endTimestamp);
    });
}

function* getMissingRanges() {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/missingRanges`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* storeSellerDataRange(subRoute, data, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/${subRoute}/${startTimestamp}-${endTimestamp}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* getSellerDataRange(subRoute, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/${subRoute}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}

function* storeCampaignDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('campaignData', data, startTimestamp, endTimestamp);
}

function* getCampaignDataRange(campaignId, startTimestamp, endTimestamp) {
    return yield* getSellerDataRange(`campaignData/${campaignId}`, startTimestamp, endTimestamp);
}

function* storeAdGroupDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('adGroupData', data, startTimestamp, endTimestamp);
}

function* getAdGroupDataRange(campaignId, adGroupId, startTimestamp, endTimestamp) {
    return yield* getSellerDataRange(`adGroupData/${campaignId}/${adGroupId}`, startTimestamp, endTimestamp);
}

function* storeAdDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('adData', data, startTimestamp, endTimestamp);
}

function* getAdDataRangeByAsin(campaignId, adGroupId, asin, startTimestamp, endTimestamp) {
    return yield* getSellerDataRange(`adData/${campaignId}/${adGroupId}/asin=${asin}`, startTimestamp, endTimestamp);
}

function* storeKeywordDataRange(data, startTimestamp, endTimestamp) {
    return yield* storeSellerDataRange('keyword', data, startTimestamp, endTimestamp);
}

function* getKeywordDataRange(campaignId, adGroupId, startTimestamp, endTimestamp) {
    return yield* getSellerDataRange(`keywordData/${campaignId}/${adGroupId}`, startTimestamp, endTimestamp);
}
