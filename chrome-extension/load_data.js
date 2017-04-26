// Inject the button, add a handler
let search = $('#searchInput');
let link = $('<a href="#">Get data history</a>');
link.click(getDataHistory);
search.after(link);

chrome.runtime.sendMessage({
    action: 'setSession', 
    entityId: getEntityId(), 
    cookies: document.cookie,
});

function getEntityId() {
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
            entityId: getEntityId(),
        }, 
        (response) => console.log(response));
    };
}

function getDataHistory() {
    chrome.runtime.sendMessage({
        action: 'getDataHistory',
        entityId: getEntityId(),
    },
    (response) => console.log(response));
}
