const bg = require('./common.js');
const sp = require('./sp.js');
const seller = require('./seller.js');

bg.messageListener(function*(req, sender) {
    // Valid on all pages
    if (req.action == 'getUser')
        return yield bg.getUser();

    // AMS actions
    if (req.action == 'sp.setSession')
        return yield sp.setSession(req);
    if (req.action == 'sp.getAllowedCampaigns') 
        return yield sp.getAllowedCampaigns(req.entityId);
    if (req.action == 'sp.getCampaignSummaries') 
        return yield sp.getCampaignSummaries(req.entityId);
    if (req.action == 'sp.getAllCampaignData')
        return yield sp.getAllCampaignData(req.entityId, req.start, req.end);
    if (req.action == 'sp.getDataHistory')
        return yield sp.getDataHistory(req.entityId, req.campaignId);
    if (req.action == 'sp.getAggregateCampaignHistory')
        return yield sp.getAggregateCampaignHistory(req.entityId, req.campaignIds);
    if (req.action == 'sp.getKeywordData')
        return yield sp.getKeywordData(req.entityId, req.adGroupId);
    if (req.action == 'sp.getAggregateKeywordData')
        return yield sp.getAggregateKeywordData(req.entityId, req.adGroupIds);
    if (req.action == 'sp.setCampaignMetadata')
        return yield sp.setCampaignMetadata(req.entityId, req.campaignId, req.asin);
    if (req.action == 'sp.setAdGroupMetadata')
        return yield sp.setAdGroupMetadata(req.entityId, req.adGroupId, req.campaignId);
    if (req.action == 'sp.updateKeyword')
        return yield sp.updateKeyword(req.entityId, req.keywordIdList, req.operation, req.dataValues);

    // Seller actions
    if (req.action == 'seller.setSession')
        return yield seller.setSession(req, sender);
    if (req.action == 'seller.getSummaries')
        return yield seller.getSummaries();
    if (req.action == 'seller.getCampaignDataRange')
        return yield seller.getCampaignDataRange(req.campaignId, req.startTimestamp, req.endTimestamp);
    if (req.action == 'seller.getAdGroupDataRange')
        return yield seller.getAdGroupDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);
    if (req.action == 'seller.getAdDataRange')
        return yield seller.getAdDataRange(req.campaignId, req.adGroupId, req.adId, req.startTimestamp, req.endTimestamp);
    if (req.action == 'seller.getAdDataRangeByAsin')
        return yield seller.getAdDataRangeByAsin(req.campaignId, req.adGroupId, req.asin, req.startTimestamp, req.endTimestamp);
    if (req.action == 'seller.getKeywordDataRange')
        return yield seller.getKeywordDataRange(req.campaignId, req.adGroupId, req.startTimestamp, req.endTimestamp);

    throw new Error('unknown action: ' + req.action);
});
