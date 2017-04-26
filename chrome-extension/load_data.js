// Inject the button, add a handler
let search = $('#searchInput');
let link = $('<a href="#">Load unlocked data</a>');
link.click(load_data_handler());
search.after(link);

/*
let buttons = $('.campaignStatusButon');
for (let btn in buttons) {
    let $btn = $(btn);
    let prev = $btn.prev();
    if (prev) {
        let campaign = prev.name.replace('campaign_', '');
    }
}
*/

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: get_entityid(), 
    cookies: document.cookie,
});

function get_entityid() {
    let qstring = window.location.search.substring(1);
    let qs = qstring.split('&');
    for (let q of qs) {
        let parts = q.split('=');
        if (parts[0] == 'entityId') {
            return parts[1];
        }
    }
    return undefined;
}

function load_data_handler(campaign) {
    return () => {
        console.log("requesting data from background service");
        chrome.runtime.sendMessage({
            action: 'requestData',
            entityId: get_entityid(),
        }, 
        (response) => console.log(response));
    };
}
