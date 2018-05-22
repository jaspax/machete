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
            options: {
                line: {
                    color: '5DA5DA',
                    dash: 'solid',
                },
                fill: 'tozeroy',
            },
        },
        clicks: {
            prop: 'clicks',
            title: 'Clicks',
            format: roundFmt,
            round: round.whole,
            options: {
                line: {
                    color: 'DECF3F',
                    dash: 'solid',
                }
            },
        },
        salesCount: {
            prop: 'salesCount',
            title: 'Sales (units)',
            format: roundFmt,
            round: round.whole,
            options: {
                line: {
                    color: '4D4D4D',
                    dash: 'longdash',
                }
            },
        },
        salesValue: {
            prop: 'salesValue',
            title: 'Sales ($)',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: '60BD68',
                    dash: 'solid',
                }
            },
        },
        sales: {
            prop: 'sales',
            title: 'Sales ($)',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: '60BD68',
                    dash: 'solid',
                }
            },
        },
        spend: {
            prop: 'spend',
            title: 'Spend',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: 'F15854',
                    dash: 'dash',
                }
            },
        },
        acos: {
            prop: 'acos',
            title: 'ACOS',
            format: pctFmt,
            round: round.none,
            options: {
                line: {
                    color: 'FAA43A',
                    dash: 'solid',
                },
                connectgaps: false,
            },
        },
        avgCpc: {
            prop: 'avgCpc',
            title: 'Average CPC',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: 'B276B2',
                    dash: 'dot',
                },
                connectgaps: false,
            },
        },
        ctr: {
            prop: 'ctr',
            title: 'Click-Through Rate',
            format: pctFmt,
            round: round.none,
            options: {
                line: {
                    color: 'DECF3F',
                    dash: 'dot',
                },
                connectgaps: false,
            },
        },
        knpeCount: {
            prop: 'knpeCount',
            title: 'KNP Estimate',
            format: roundFmt,
            round: round.whole,
            options: {
                line: {
                    color: '4D4D4D',
                    dash: 'longdash',
                },
                connectgaps: false,
            },
        },
        knpeValue: {
            prop: 'knpeValue',
            title: 'KU Income Estimate ($)',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: '60BD68',
                    dash: 'dot',
                },
                connectgaps: false,
            },
        },
        knpeTotalValue: {
            prop: 'knpeTotalValue',
            title: 'Income Estimate Including KU ($)',
            format: moneyFmt,
            round: round.money,
            options: {
                line: {
                    color: '60BD68',
                    dash: 'dashdot',
                },
                connectgaps: false,
            },
        },
        knpeAcos: {
            prop: 'knpeAcos',
            title: 'ACOS Including KU Estimate',
            format: pctFmt,
            round: round.none,
            options: {
                line: {
                    color: 'FAA43A',
                    dash: 'dashdot',
                },
                connectgaps: false,
            },
        },
    },
};
