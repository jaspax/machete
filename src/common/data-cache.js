module.exports = function() {
    function coMemo(fn) {
        return fn;
    }

    return {
        coMemo,
        clear: () => {}, // eslint-disable-line no-empty-function
    };
};
