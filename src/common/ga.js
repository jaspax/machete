const ga = require('../shared/ga')(process.env.ANALYTICS_ID, process.env.HOSTNAME);
const cache = require('../shared/cache');

cache.setAnalytics(ga);

/* These extensions allow unified logging that can be send through the logging
 * port, but aren't present to other callers.
 */
const logListeners = [];
function mlog(msg) {
    for (const listener of logListeners) {
        try {
            listener.log(msg);
        }
        catch (ex) {
            console.error('exception in log listener', listener, 'msg', msg, 'ex', ex);
        }
    }
}

const extend = {
    debug(...msgs) {
        console.log(...msgs);
        mlog({ level: 'debug', msgs });
    },

    info(...msgs) {
        console.log(...msgs);
        mlog({ level: 'info', msgs });
    },

    warn(...msgs) {
        console.warn(...msgs);
        mlog({ level: 'warn', msgs });
    },

    error(...msgs) {
        console.error(...msgs);
        mlog({ level: 'error', msgs });
    },

    addLogListener(listener) {
        logListeners.push(listener);
    },

    removeLogListener(listener) {
        const i = logListeners.indexOf(listener);
        if (i >= 0)
            logListeners.splice(i);
    },
};

module.exports = Object.assign(ga, extend);
