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
    throw new Error('unknown action');
});

function* synchronizeCampaignData() {
    console.log('synchronizeCampaignData start at', new Date());

    try {
        const ranges = yield* getMissingRanges();
        for (const range of ranges) {
            const campaignIds = yield* requestCampaignDataRange(range.start, range.end);
            for (const campaignId of campaignIds) {
                const adGroupIds = yield* requestAdGroupDataRange(campaignId, range.start, range.end);
                for (const adGroupId of adGroupIds) {
                    yield* requestAdDataRange(campaignId, adGroupId, range.start, range.end);
                }
            }
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

function* requestCampaignDataRange(startTimestamp, endTimestamp) {
    const campaignIds = new Set();
    yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting campaign data in range', startTimestamp, endTimestamp, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/campaign/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startTimestamp,
                endTimestamp,
                aggregates: false,
                statusFilter: 'ENABLED'
            },
            dataType: 'json',
        });
        yield* storeCampaignDataRange(data, startTimestamp, endTimestamp);

        // Gather the IDs of the campaigns discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && campaignIds.add(x[idIndex]));

        return data;
    });

    return campaignIds;
}

function* requestAdGroupDataRange(campaignId, startTimestamp, endTimestamp) {
    const adGroupIds = new Set();
    yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting adGroupData data in range', startTimestamp, endTimestamp, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/adgroup/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startTimestamp,
                endTimestamp,
                aggregates: false,
                statusFilter: 'ENABLED',
                filters: JSON.stringify({campaign: { id: { eq: [campaignId] } } }),
            },
            dataType: 'json',
        });
        yield* storeAdGroupDataRange(data, startTimestamp, endTimestamp);

        // Gather the adGroupIds of the ad groups discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && adGroupIds.add(x[idIndex]));

        return data;
    });

    return adGroupIds;
}

function* requestAdDataRange(campaignId, adGroupId, startTimestamp, endTimestamp) {
    return yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting ad data in range', startTimestamp, endTimestamp, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/ad/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startTimestamp,
                endTimestamp,
                aggregates: false,
                statusFilter: 'ENABLED',
                filters: JSON.stringify({campaign: { id: { eq: [campaignId] } }, adGroup: { id: { ed: [adGroupId] } } }),
            },
            dataType: 'json',
        });
        yield* storeAdDataRange(data, startTimestamp, endTimestamp);
        return data;
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
