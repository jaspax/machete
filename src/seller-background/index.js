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
    throw new Error('unknown action');
});

function* synchronizeCampaignData() {
    console.log('synchronizeCampaignData start at', new Date());

    try {
        const ranges = yield* getMissingRanges();
        for (const range of ranges) {
            yield* requestCampaignDataRange(range.start, range.end);
        }
    }
    finally {
        console.log('synchronizeCampaignData finish at', new Date());
    }
}

function* setSession() {
    yield* synchronizeCampaignData();
}

function* requestCampaignDataRange(startDate, endDate) {
    let data = null;
    try {
        console.log('requesting campaign data in range', startDate, endDate);
        const pageSize = 50;
        let currentPage = 0;
        let totalRecords = 0;
        do {
            data = yield $.ajax('https://sellercentral.amazon.com/hz/cm/campaign/fetch', {
                method: 'GET',
                data: {
                    sEcho: 1,
                    parentCreationDate: 0,
                    iDisplayStart: currentPage,
                    iDisplayLength: pageSize,
                    statisticsPeriod: 'CUSTOMIZED',
                    startDate,
                    endDate,
                    aggregates: false,
                    statusFilter: 'ENABLED'
                },
                dataType: 'json',
            });

            totalRecords = data.iTotalRecords;
            currentPage++;

            yield* storeCampaignDataRange(data, startDate, endDate);
        }
        while (currentPage * pageSize < totalRecords);
    }
    catch (ex) {
        /* TURN THIS BACK ON SHORTLY
        if (ex.status == 401) { // Unauthorized
            notifyNeedCredentials();
        } */
        throw ex;
    }

    return data;
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
