const bg = require('./common.js');
const sp = require('./sp.js');
const kdp = require('./kdp.js');

bg.messageListener(function(req) { // eslint-disable-line complexity
    switch (req.action) {
        // Valid for every page
        case 'sayHello':
            return bg.sayHello(req);

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
        case 'sp.requestPortfolios':
            return sp.requestPortfolios(req);

        // KDP actions
        case 'kdp.requestPermission':
            return kdp.requestPermission(req);
        case 'kdp.hasPermission':
            return kdp.hasPermission(req);
        case 'kdp.requestAsins':
            return kdp.requestAsins(req);
        case 'kdp.requestSalesData':
            return kdp.requestSalesData(req);
        case 'kdp.requestKuData':
            return kdp.requestKuData(req);

        default:
            throw new Error('unknown action: ' + req.action);
    }
});
