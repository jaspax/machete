const ga = require('./ga.js');
const constants = require('./constants.js');

function bgMessage(opts) {
    opts.domain = window.location.hostname;
    return ga.mpromise((resolve, reject) => {
        chrome.runtime.sendMessage(opts, response => {
            if (response.error)
                return reject(response.error);
            return resolve(response.data);
        });
    });
}

function* pageArray(array, step) {
    if (!array || !array.length)
        return;
    for (let index = 0; index < array.length; index += step) {
        yield array.slice(index, index + step);
    }
}

module.exports = {
    moneyFmt: constants.moneyFmt,
    pctFmt: constants.pctFmt,
    numberFmt: constants.numberFmt,
    roundFmt: constants.roundFmt,
    bgMessage,
    pageArray,
};
