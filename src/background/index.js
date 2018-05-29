const bg = require('./common.js');
const sp = require('./sp.js');
const seller = require('./seller.js');
const kdp = require('./kdp.js');

bg.messageListener(function*(req) { // eslint-disable-line complexity
    switch (req.action) {
        // Valid for every page
        case 'getUser':
            return yield bg.getUser(req);
        case 'startSession':
            return yield bg.startSession(req);

        // AMS actions
        case 'sp.getAllowedCampaigns': 
            return yield sp.getAllowedCampaigns(req);
        case 'sp.getCampaignSummaries': 
            return yield sp.getCampaignSummaries(req);
        case 'sp.getAllCampaignData':
            return yield sp.getAllCampaignData(req);
        case 'sp.getDataHistory':
            return yield sp.getDataHistory(req);
        case 'sp.getAggregateCampaignHistory':
            return yield sp.getAggregateCampaignHistory(req);
        case 'sp.getKeywordData':
            return yield sp.getKeywordData(req);
        case 'sp.getAggregateKeywordData':
            return yield sp.getAggregateKeywordData(req);
        case 'sp.setCampaignMetadata':
            return yield sp.setCampaignMetadata(req);
        case 'sp.setAdGroupMetadata':
            return yield sp.setAdGroupMetadata(req);
        case 'sp.updateKeyword':
            return yield sp.updateKeyword(req);

        // Seller actions
        case 'seller.getSummaries':
            return yield seller.getSummaries(req);
        case 'seller.getCampaignDataRange':
            return yield seller.getCampaignDataRange(req);
        case 'seller.getAdGroupDataRange':
            return yield seller.getAdGroupDataRange(req);
        case 'seller.getAdDataRange':
            return yield seller.getAdDataRange(req);
        case 'seller.getAdDataRangeByAsin':
            return yield seller.getAdDataRangeByAsin(req);
        case 'seller.getKeywordDataRange':
            return yield seller.getKeywordDataRange(req);

        // KDP actions
        case 'kdp.requestPermission':
            return yield kdp.requestPermission(req);
        case 'kdp.hasPermission':
            return yield kdp.hasPermission(req);

        default:
            throw new Error('unknown action: ' + req.action);
    }
});
