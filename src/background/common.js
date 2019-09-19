const serviceUrl = `https://${process.env.HOSTNAME}`;

const ga = require('../common/ga.js');
const api = require('../shared/api')(serviceUrl);
const data = require('./data-gather');

const dataGatherAlarmName = 'machete.alarm.data-gather';
const dataGatherAlarmPeriod = 200;

chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == 'install') {
        chrome.tabs.create({ url: `${serviceUrl}/setup/postinstall` });
    }
});

chrome.pageAction.onClicked.addListener(ga.mcatch(() => {
    chrome.tabs.create({ url: `${serviceUrl}/dashboard` });
}));

function handlePortConnect(messageHandler) {
    return port => {
        if (port.name == 'machete.action') {
            port.onMessage.addListener(req => {
                messageHandler(req, port, res => port.postMessage(Object.assign(res, { msgId: req.msgId })));
            });
        }
        if (port.name == 'machete.log') {
            const listener = {
                log(msg) {
                    port.postMessage(msg);
                }
            };
            ga.addLogListener(listener);
            port.onDisconnect.addListener(() => {
                ga.removeLogListener(listener);
            });
        }
    };
}

function messageListener(handler) {
    const messageHandler = createMessageHandler(handler);

    chrome.runtime.onMessage.addListener(messageHandler);
    chrome.runtime.onMessageExternal.addListener(messageHandler);
    chrome.runtime.onConnect.addListener(handlePortConnect(messageHandler));
    chrome.runtime.onConnectExternal.addListener(handlePortConnect(messageHandler));
}

function registerAlarms() {
    chrome.alarms.onAlarm.addListener(alarm => {
        ga.debug('handling alarm', alarm);
        if (alarm.name == dataGatherAlarmName) {
            dataGatherAlarm();
            return;
        }
        ga.warn('Unhandled alarm', alarm);
    });

    chrome.alarms.get(dataGatherAlarmName, alarm => {
        ga.debug('existing alarm:', alarm);
        if (!alarm || alarm.periodInMinutes != dataGatherAlarmPeriod)
            chrome.alarms.create(dataGatherAlarmName, { periodInMinutes: dataGatherAlarmPeriod });
    });
}

function createMessageHandler(handler) {
    return ga.mcatch((req, sender, sendResponse) => {
        ga.debug('Handling message:', req);
        if (sender.tab && sender.tab.incognito) {
            sendResponse({ 
                error: {
                    handled: 'incognito',
                    message: 'Machete cannot be used in incognito mode',
                }
            });
            return true;
        }

        async function f() {
            if (sender.tab)
                chrome.pageAction.show(sender.tab.id);

            ga.mevent('background-message', req.action);
            try {
                let data = await handler(req, sender);
                if (typeof data == 'undefined')
                    data = ''; // must return a defined falsy value!

                const response = { data };
                ga.debug('Success handling message:', req, "response", response);
                sendResponse(response);
            }
            catch (error) {
                if (handlePortDisconnected(error, req.action))
                    return;
                if (handleMessageTooLong(error, req.action))
                    return;

                const response = { status: error.message, error: ga.errorToObject(error) };
                const handled = handleServerErrors(error, req.action);
                if (handled) {
                    response.error.handled = handled;
                    ga.warn(error);
                }
                else {
                    ga.merror(req, error);
                }

                try {
                    sendResponse(response);
                }
                catch (ex) {
                    handlePortDisconnected(ex, req.action);
                }
            }
        }
        f();

        return true;
    });
}

function sayHello() {
    const manifest = chrome.runtime.getManifest();
    return { 
        ok: true,
        version: manifest.version,
    };
}

function handleServerErrors(ex, desc) {
    if (ex.url && ex.url.match(/machete-app.com/)) {
        if (ex.message.match(/^401/)) {
            ga.mevent('error-handled', 'auth-error-401', desc);
            return 'notLoggedIn';
        }
        if (ex.message.match(/^402/)) {
            ga.mevent('error-handled', 'auth-error-402', desc);
            return 'notAllowed';
        }
        if (ex.message.match(/^403/)) {
            ga.mevent('error-handled', 'auth-error-403', desc);
            return 'notOwned';
        }
    }
    if (ex.message.match(/^401/)) {
        ga.mevent('error-handled', 'network-error-401', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^403/)) {
        ga.mevent('error-handled', 'network-error-403', desc);
        return 'amazonNotLoggedIn';
    }
    if (ex.message.match(/^404/)) {
        ga.mevent('error-handled', 'network-error-404', desc);
        return 'notFound';
    }
    if (ex.message.match(/^50/)) {
        ga.mevent('error-handled', 'server-error', desc);
        return 'serverError';
    }
    if (ex.message.match(/0 error/) || ex.message.match(/Failed to fetch/)) {
        ga.mevent('error-handled', 'network-error-unknown', desc);
        return 'amazonNotLoggedIn';
    }
    return null;
}

function handlePortDisconnected(ex, desc) {
    if (ex.message.match(/disconnected port object/)) {
        ga.mevent('error-handled', 'port-disconnected', desc);
        return true;
    }
    return false;
}

function handleMessageTooLong(ex, req) {
    if (ex.message.match(/exceeded maximum allowed length/)) {
        ga.merror(ex.message, req);
        return true;
    }
    return false;
}

async function dataGatherAlarm() {
    try {
        await data.dataGatherKdp();
    }
    catch (ex) {
        ga.merror(ex);
    }

    const entities = await api.getEntityMetadata();
    for (const entity of entities) {
        try {
            await data.dataGather(entity);
        }
        catch (ex) {
            ga.merror(ex);
        }
    }
    await data.setLastDataGather(Date.now());
}

module.exports = {
    messageListener,
    registerAlarms,
    sayHello,
};
