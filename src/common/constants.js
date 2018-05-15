const round = {
    none: x => x,
    whole: Math.round,
    money: x => Math.round(x * 100)/100
};

function moneyFmt(val) {
    return '$' + numberFmt(val, 2);
}

function pctFmt(val) {
    return numberFmt(val, 1) + '%';
}

function numberFmt(val, digits = 2) {
    if (Number.isNaN(+val)) {
        return ' -- ';
    }
    let start = (+val).toFixed(digits); 
    while (true) { // eslint-disable-line no-constant-condition
        const next = start.replace(/(\d)(\d\d\d([,.]|$))/, "$1,$2");
        if (start == next)
            return next;
        start = next;
    }
}

function roundFmt(val) {
    if (Number.isNaN(+val)) {
        return ' -- ';
    }
    return Math.round(val);
}

module.exports = {
    hostname: process.env.HOSTNAME,
    timespan: {
        second: 1000,
        minute: 1000 * 60,
        hour: 1000 * 60 * 60,
        day: 1000 * 60 * 60 * 24,
    },

    /* Formatters */
    moneyFmt,
    pctFmt,
    numberFmt,
    roundFmt,

    /* These properties are used to map together necessary properties with
     * metric properties, titles, chart colors, etc.
     */
    metric: {
        impressions: {
            prop: 'impressions',
            title: 'Impressions',
            format: roundFmt,
            round: round.whole,
        },
        clicks: {
            prop: 'clicks',
            title: 'Clicks',
            format: roundFmt,
            round: round.whole,
        },
        salesCount: {
            prop: 'salesCount',
            title: 'Sales (units)',
            format: roundFmt,
            round: round.whole,
        },
        salesValue: {
            prop: 'salesValue',
            title: 'Sales ($)',
            format: moneyFmt,
            round: round.money,
        },
        sales: {
            prop: 'sales',
            title: 'Sales ($)',
            format: moneyFmt,
            round: round.money,
        },
        spend: {
            prop: 'spend',
            title: 'Spend',
            format: moneyFmt,
            round: round.money,
        },
        acos: {
            prop: 'acos',
            title: 'ACOS',
            format: pctFmt,
            round: round.none,
        },
        avgCpc: {
            prop: 'avgCpc',
            title: 'Average CPC',
            format: moneyFmt,
            round: round.money,
        },
        ctr: {
            prop: 'ctr',
            title: 'Click-Through Rate',
            format: pctFmt,
            round: round.none,
        },
    },
};
