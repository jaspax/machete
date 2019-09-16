const ga = require('../shared/ga')(process.env.ANALYTICS_ID, process.env.HOSTNAME);
module.exports = ga;
