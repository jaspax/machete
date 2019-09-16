const bg = require('./common.js');
const kdp = require('./kdp.js');
const sp = require('./sp.js');
const data = require('./data-gather');

bg.messageListener(function(req) { // eslint-disable-line complexity
    switch (req.action) {
        // Valid for every page
        case 'sayHello':
            return bg.sayHello(req);

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

        // Data gathering
        case 'data.dataGather':
            return data.dataGather(req.entity);
        case 'data.dataGatherKdp':
            return data.dataGatherKdp();
        case 'data.syncKeywordData':
            return data.syncKeywordData(req.entity, req.campaign, req.adGroupId);
        case 'data.setLastDataGather':
            return data.setLastDataGather(req.timestamp);
        case 'data.getLastDataGather':
            return data.getLastDataGather();


        default:
            throw new Error('unknown action: ' + req.action);
    }
});
