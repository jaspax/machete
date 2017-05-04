'use strict';

const prefix = 'ams-unlocked';
const span = {
    second: 1000,
    minute: 1000 * 60,
    hour:   1000 * 60 * 60,
    day:    1000 * 60 * 60 * 24,
};

const getEntityId = () => getQueryArgs()['entityId'];
const getCampaignId = () => getQueryArgs()['campaignId'];
const unlockSvg = chrome.runtime.getURL('images/unlock.svg');
const chartPng = chrome.runtime.getURL('images/chart-16px.png');

function getQueryArgs() {
    let qstring = window.location.search.substring(1);
    let qs = qstring.split('&');
    let args = {};
    for (let q of qs) {
        let parts = q.split('=');
        args[parts[0]] = parts[1];
    }
    return args;
}

function moneyFmt(val) {
    if (Number.isNaN(+val)) {
        return '--';
    }
    return `$${(+val).toFixed(2)}`;
}

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
    cookies: document.cookie,
});

