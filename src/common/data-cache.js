const memoize = require('memoizee');
const constants = require('./constants.js');
const co = require('co');

module.exports = function() {

    const memoized = [];
    const memoOptsDefault = {
        promise: true,
        length: false,
        primitive: true,
        maxAge: 6 * constants.timespan.hour,
    };

    function coMemo(fn, opts = {}) {
        const rv = memoize((...args) => co(fn(...args)), 
                           Object.assign({}, memoOptsDefault, opts));
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
