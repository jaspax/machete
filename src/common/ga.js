/* eslint-disable no-unused-vars */
/* global __ga:false */

function isBackgroundPage() {
    return location.protocol == 'chrome-extension:';
}

// Execute a function in the context of the hosting page. For Chrome extension
// scripts, we execute directly. Local runs should never actually post data to
// the server.
function inpage(fn, args) {
    if (process.env.MACHETE_LOCAL)
        return;

    args = args || [];
    if (isBackgroundPage()) {
        fn(...args);
    }
    else {
        const script = document.createElement('script');
        const sargs = JSON.stringify(args);
        const text = `(${fn.toString()}).apply(null, ${sargs});`;
        script.textContent = text;
        document.documentElement.appendChild(script);
        document.documentElement.removeChild(script);
    }
}

/* eslint-disable */
inpage(function () {
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o);
    a.async=1;a.src=g;document.documentElement.appendChild(a)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','__ga');
});

inpage(function () {
    __ga('create', process.env.ANALYTICS_ID, 'auto', 'machete');
    __ga(function() {
        if (isBackgroundPage()) {
            const tracker = __ga.getByName('machete');
            tracker.set('checkProtocolTask', null);
        }
        const manifest = chrome.runtime.getManifest();
        __ga('machete.set', 'dimension1', manifest.version);
        __ga('machete.set', 'dimension2', manifest.name);
        __ga('machete.send', 'pageview', location.pathname);
    });
});
/* eslint-enable */

// This is next to useless, but at least we'll get *something*
window.onerror = merror;

function mga(...args) {
    inpage(function(...a) {
        __ga(...a);
    }, ['machete.send', ...args]);
}

function errorToObject(error) {
    const err = {};
    Object.getOwnPropertyNames(error).forEach(prop => {
        err[prop] = error[prop];
    });
    return err;
}

function errorToString(error) {
    return JSON.stringify(error, (key, value) => {
        if (value instanceof Error) {
            return errorToObject(error);
        }
        return value;
    });
}

function merror(...msg) {
    const ex = msg[0] instanceof Error ? msg[0] : new Error();

    // We do this to capture both the stack at the point which the error was
    // thrown (if any) and the stack where the error was caught. The latter
    // condition is more important in the cases where we don't actually capture
    // an exception but some other kind of message.
    let errstr = msg.map(errorToString).join(' ');
    let err = new Error(errstr);

    mga('exception', { exDescription: error.stack, exFatal: !ex.handled });
    error(ex.handled ? '[handled]' : '', err);
}

function mcatch(fn) {
    return function(...args) {
        try {
            return fn.apply(this, args); // eslint-disable-line no-invalid-this
        }
        catch (ex) {
            merror(ex);
            ex.handled = true;
            throw ex;
        }
    };
}

function mpromise(arg) {
    let promise = null;
    if (arg.then && arg.catch) {
        promise = arg;
    }
    else if (arg.constructor && arg.constructor.name == 'AsyncFunction') {
        promise = arg();
    }
    else {
        promise = new Promise(arg);
    }
    return promise.catch(error => {
        if (error.handled) {
            console.warn(error);
        }
        else {
            merror(error);
        }
        error.handled = true;
        return Promise.reject(error);
    });
}

function revent(eventId, eventData) {
    try {
        const opts = {
            method: 'PUT',
            headers: new Headers(),
            mode: 'cors',
            credentials: 'include',
            redirect: 'error',
            body: JSON.stringify({ eventId, eventData }),
        };
        opts.headers.set('Content-Type', 'application/json');

        window.fetch(`https://${process.env.HOSTNAME}/evt`, opts).then(response => {
            if (!response.ok && response.status != 401) {
                merror(`revent ${eventId} ${eventData} response error: ${response.status} ${response.statusText}`);
            }
        });
    }
    catch (ex) {
        merror(`revent ${eventId} ${eventData} create error`, ex);
    }
}

const logListeners = [];
function mlog(msgs) {
    for (const listener of logListeners) {
        try {
            listener.log(msgs);
        }
        catch (ex) {
            console.error(`exception in log listener ${listener} msgs ${msgs} ex ${ex}`);
        }
    }
}

function debug(...msgs) {
    console.log(...msgs);
    mlog({ level: 'debug', msgs });
}

function info(...msgs) {
    console.log(...msgs);
    mlog({ level: 'info', msgs });
}

function warn(...msgs) {
    console.warn(...msgs);
    mlog({ level: 'warn', msgs });
}

function error(...msgs) {
    console.error(...msgs);
    mlog({ level: 'error', msgs });
}

function addLogListener(listener) {
    logListeners.push(listener);
}

function removeLogListener(listener) {
    const i = logListeners.indexOf(listener);
    if (i >= 0)
        logListeners.splice(i);
}

module.exports = {
    addLogListener,
    errorToObject, 
    errorToString, 
    mcatch,
    merror,
    mga,
    mpromise,
    removeLogListener,
    revent,
    debug,
    info,
    warn,
    error,
};
