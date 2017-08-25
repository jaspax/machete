module.exports = {
    hostname: process.env.HOSTNAME,
    timespan: {
        second: 1000,
        minute: 1000 * 60,
        hour: 1000 * 60 * 60,
        day: 1000 * 60 * 60 * 24,
    }
};
