const bg = require('./common.js');
const sp = require('./sp.js');
const seller = require('./seller.js');
const kdp = require('./kdp.js');

bg.messageListener(function(req) { // eslint-disable-line complexity
    switch (req.action) {
        // Valid for every page
        case 'getUser':
            return bg.getUser(req);
        case 'startSession':
            return bg.startSession(req);
        case 'sayHello':
            return bg.sayHello(req);

        // AMS actions
        case 'sp.getAllowedCampaigns': 
            return sp.getAllowedCampaigns(req);
        case 'sp.getCampaignSummaries': 
            return sp.getCampaignSummaries(req);
        case 'sp.getAllCampaignData':
            return sp.getAllCampaignData(req);
        case 'sp.getDataHistory':
            return sp.getDataHistory(req);
        case 'sp.getAggregateCampaignHistory':
            return sp.getAggregateCampaignHistory(req);
        case 'sp.getKeywordData':
            return sp.getKeywordData(req);
        case 'sp.getAggregateKeywordData':
            return sp.getAggregateKeywordData(req);
        case 'sp.storeAdGroupMetadata':
            return sp.storeAdGroupMetadata(req);
        case 'sp.setBrandName':
            return sp.setBrandName(req);

        // Actions used by the Machete Dashboard integration
        case 'sp.updateKeyword':
            return sp.updateKeyword(req);
        case 'sp.addKeywords':
            return sp.addKeywords(req);
        case 'sp.updateCampaigns':
            return sp.updateCampaigns(req);
        case 'sp.requestLifetimeCampaignData':
            return sp.requestLifetimeCampaignData(req);
        case 'sp.requestDailyCampaignData':
            return sp.requestDailyCampaignData(req);
        case 'sp.requestAdGroupId':
            return sp.requestAdGroupId(req);
        case 'sp.requestCampaignAsin':
            return sp.requestCampaignAsin(req);
        case 'sp.requestKeywordData':
            return sp.requestKeywordData(req);
        case 'sp.requestAdEntities':
            return sp.requestAdEntities(req);
        case 'kdp.requestPermission':
            return kdp.requestPermission(req);
        case 'kdp.hasPermission':
            return kdp.hasPermission(req);
        case 'kdp.getSalesHistory':
            return kdp.getSalesHistory(req);

        // Seller actions
        case 'seller.getSummaries':
            return seller.getSummaries(req);
        case 'seller.getCampaignDataRange':
            return seller.getCampaignDataRange(req);
        case 'seller.getAdGroupDataRange':
            return seller.getAdGroupDataRange(req);
        case 'seller.getAdDataRange':
            return seller.getAdDataRange(req);
        case 'seller.getAdDataRangeByAsin':
            return seller.getAdDataRangeByAsin(req);
        case 'seller.getKeywordDataRange':
            return seller.getKeywordDataRange(req);

        default:
            throw new Error('unknown action: ' + req.action);
    }
});
