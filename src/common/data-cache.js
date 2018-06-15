const memoize = require('memoizee');
const constants = require('./constants.js');

module.exports = function() {

    const memoized = [];
    const memoOptsDefault = {
        promise: true,
        length: false,
        primitive: true,
        normalizer: JSON.stringify,
        maxAge: 6 * constants.timespan.hour,
    };

    function coMemo(fn, opts = {}) {
        const rv = memoize(fn, Object.assign({}, memoOptsDefault, opts));
        memoized.push(rv);
        return rv;
    }

    function clear() {
        memoized.forEach(fn => fn.clear());
    }

    return {
        coMemo,
        clear,
    };
};
