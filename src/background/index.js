const bg = require('./common.js');
const sp = require('./sp.js');
const seller = require('./seller.js');
const kdp = require('./kdp.js');

bg.messageListener(function*(req) { // eslint-disable-line complexity
    switch (req.action) {
        // Valid for every page
        case 'getUser':
            return yield bg.getUser();
        case 'startSession':
            return yield bg.startSession(req);

        // AMS actions
        case 'sp.getAllowedCampaigns': 
            return yield sp.getAllowedCampaigns(req.entityId);
        case 'sp.getCampaignSummaries': 
            return yield sp.getCampaignSummaries(req.entityId);
        case 'sp.getAllCampaignData':
            return yield sp.getAllCampaignData(req.entityId, req.start, req.end);
        case 'sp.getDataHistory':
            return yield sp.getDataHistory(req.entityId, req.campaignId);
        case 'sp.getAggregateCampaignHistory':
            return yield sp.getAggregateCampaignHistory(req.entityId, req.campaignIds);
        case 'sp.getKeywordData':
            return yield sp.getKeywordData(req.entityId, req.adGroupId);
        case 'sp.getAggregateKeywordData':
            return yield sp.getAggregateKeywordData(req.entityId, req.adGroupIds);
        case 'sp.setCampaignMetadata':
            return yield sp.setCampaignMetadata(req.entityId, req.campaignId, req.asin);
        case 'sp.setAdGroupMetadata':
            return yield sp.setAdGroupMetadata(req.entityId, req.adGroupId, req.campaignId);
        case 'sp.updateKeyword':
            return yield sp.updateKeyword(req.entityId, req.keywordIdList, req.operation, req.dataValues);

        // Seller actions
        case 'seller.getSummaries':
            return yield seller.getSummaries();
        case 'seller.getCampaignDataRange':
            return yield seller.getCampaignDataRange(req.campaignId, req.startTimestamp, req.endTimestamp);
        case 'seller.getAdGroupDataRange':
            return yield seller.getAdGroupDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);
        case 'seller.getAdDataRange':
            return yield seller.getAdDataRange(req.campaignId, req.adGroupId, req.adId, req.startTimestamp, req.endTimestamp);
        case 'seller.getAdDataRangeByAsin':
            return yield seller.getAdDataRangeByAsin(req.campaignId, req.adGroupId, req.asin, req.startTimestamp, req.endTimestamp);
        case 'seller.getKeywordDataRange':
            return yield seller.getKeywordDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);

        // KDP actions
        case 'kdp.requestPermission':
            return yield kdp.requestPermission();

        default:
            throw new Error('unknown action: ' + req.action);
    }
});
