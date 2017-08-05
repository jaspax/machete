const path = require('path');

module.exports = {
    context: path.resolve(__dirname, "src"),
    entry: {
        dashboard: ["./extern/jquery.min.js", "./extern/plotly-latest.min.js", 
                 "./common/common.js", "./common/ga.js", "./dashboard/dashboard.js"],
        campaign: ["./extern/jquery.min.js", "./extern/plotly-latest.min.js", "./extern/jquery.dataTables.min.js", 
                 "./extern/moment.min.js", "./extern/pikaday.js",
                 "./common/common.js", "./common/ga.js", "./campaign/campaign.js"]
    },
    output: {
        path: path.resolve(__dirname, "out"),
        filename: '[name].js'
    },
};
