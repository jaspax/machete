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
    throw new Error('unknown action');
});

function* synchronizeCampaignData() {
    console.log('synchronizeCampaignData start at', new Date());

    try {
        const ranges = yield* getMissingRanges();
        for (const range of ranges) {
            const campaignIds = yield* requestCampaignDataRange(range.start, range.end);
            for (const id of campaignIds) {
                yield* requestAdGroupDataRange(id, range.start, range.end);
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
    let campaignIds = [];
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
        campaignIds = campaignIds.concat(data.aaData.map(x => x[idIndex]).filter(x => x));

        return data;
    });

    return campaignIds;
}

function* requestAdGroupDataRange(campaignId, startDate, endDate) {
    return yield* requestAllPages(function*(pageSize, currentRecord) {
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
        return data;
    });
}

function* getMissingRanges() {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/missingRanges`, {
        method: 'GET',
        dataType: 'json',
    });
}

function* storeCampaignDataRange(data, startDate, endDate) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/${startDate}-${endDate}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* getCampaignDataRange(campaignId, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/campaignData/${campaignId}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}

function* storeAdGroupDataRange(data, startDate, endDate) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/adGroupData/${startDate}-${endDate}`, {
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
    });
}

function* getAdGroupDataRange(campaignId, adGroupId, startTimestamp, endTimestamp) {
    return yield $.ajax(`https://${constants.hostname}/api/seller/adGroupData/${campaignId}/${adGroupId}/${startTimestamp}-${endTimestamp}`, {
        method: 'GET',
        dataType: 'json'
    });
}
