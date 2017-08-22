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

function* requestCampaignDataRange(startDate, endDate) {
    const campaignIds = new Set();
    yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting campaign data in range', startDate, endDate, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/campaign/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startDate,
                endDate,
                aggregates: false,
                statusFilter: 'ENABLED'
            },
            dataType: 'json',
        });
        yield* storeCampaignDataRange(data, startDate, endDate);

        // Gather the IDs of the campaigns discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && campaignIds.add(x[idIndex]));

        return data;
    });

    return campaignIds;
}

function* requestAdGroupDataRange(campaignId, startDate, endDate) {
    const adGroupIds = new Set();
    yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting adGroupData data in range', startDate, endDate, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/adgroup/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startDate,
                endDate,
                aggregates: false,
                statusFilter: 'ENABLED',
                filters: JSON.stringify({campaign: { id: { eq: [campaignId] } } }),
            },
            dataType: 'json',
        });
        yield* storeAdGroupDataRange(data, startDate, endDate);

        // Gather the adGroupIds of the ad groups discovered in this data range
        const idIndex = data.columnNames.indexOf('id');
        data.aaData.forEach(x => x[idIndex] && adGroupIds.add(x[idIndex]));

        return data;
    });

    return adGroupIds;
}

function* requestAdDataRange(campaignId, adGroupId, startDate, endDate) {
    return yield* requestAllPages(function*(pageSize, currentRecord) {
        console.log('requesting ad data in range', startDate, endDate, 'record', currentRecord);
        const data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/ad/fetch', {
            method: 'GET',
            data: {
                sEcho: 1,
                parentCreationDate: 0,
                iDisplayStart: currentRecord,
                iDisplayLength: pageSize,
                statisticsPeriod: 'CUSTOMIZED',
                startDate,
                endDate,
                aggregates: false,
                statusFilter: 'ENABLED',
                filters: JSON.stringify({campaign: { id: { eq: [campaignId] } }, adGroup: { id: { ed: [adGroupId] } } }),
            },
            dataType: 'json',
        });
        yield* storeAdDataRange(data, startDate, endDate);
        return data;
    });
}

function* getMissingRanges() {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/missingRanges`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* storeSellerDataRange(subRoute, data, startDate, endDate) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/${subRoute}/${startDate}-${endDate}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* storeCampaignDataRange(data, startDate, endDate) {
    return yield* storeSellerDataRange('campaignData', data, startDate, endDate);
}

function* getCampaignDataRange(campaignId, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/${campaignId}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}

function* storeAdGroupDataRange(data, startDate, endDate) {
    return yield* storeSellerDataRange('adGroupData', data, startDate, endDate);
}

function* getAdGroupDataRange(campaignId, adGroupId, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/adGroupData/${campaignId}/${adGroupId}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}

function* storeAdDataRange(data, startDate, endDate) {
    return yield* storeSellerDataRange('adData', data, startDate, endDate);
}

function* getAdDataRangeByAsin(campaignId, adGroupId, asin, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/adData/${campaignId}/${adGroupId}/asin=${asin}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}
