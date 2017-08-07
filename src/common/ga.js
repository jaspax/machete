const $ = require('jquery');

/* eslint-disable no-unused-vars */
/* global __ga:false */

// Execute a function in the context of the hosting page. For Chrome extension
// scripts, we execute directly.
function inpage(fn, args) {
    if (location.protocol == 'chrome-extension:') {
        fn(args);
    }
    else {
        const script = document.createElement('script');
        const sargs = JSON.stringify(args);
        const text = `(${fn.toString()}).apply(null, ${sargs});`;
        script.textContent = text;
        document.documentElement.appendChild(script);
        document.documentElement.removeChild(script);
    }
}

// Add Universal Analytics to the page. Only do this on http(s); not in the
// chrome extension itself.
/* eslint-disable */
inpage(function () {
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o);
    a.async=1;a.src=g;document.documentElement.appendChild(a)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','__ga');
});

/* eslint-enable */

inpage(function () {
    __ga('create', 'UA-98724833-1', 'auto', 'machete');
    __ga('machete.send', 'pageview', location.pathname);
});

// This is next to useless, but at least we'll get *something*
window.onerror = function(errorMsg, url, lineNumber) {
    inpage(function(_errorMsg, _url, _lineNumber) {
        __ga('machete.send', 'exception', { exDescription: `${_errorMsg}; ${_url}:${_lineNumber}`, exFatal: true });
    }, [errorMsg, url, lineNumber]);
};

$(document).on('click.machete.ga', '[data-mclick]', function() {
    const args = $(this).attr('data-mclick').split(' ');
    let category = args[0];
    let label = args[1] || this.id;
    mclick(category, label);
    return true;
});

function mga(...args) {
    inpage(function(...a) {
        __ga.apply(null, a);
    }, ['machete.send'].concat(args));
}

function merror(...msg) {
    let error = new Error(msg.join(' '));
    mex(new Error(msg), false);
    return error;
}

function mex(ex, fatal) {
    mga('exception', { exDescription: ex.stack, exFatal: fatal });
    console.error(ex);
}

function mclick(category, label) {
    mga('event', category, 'click', label);
}

function mcatch(fn) {
    return function(...args) {
        try {
            fn.apply(this, args);
        }
        catch (ex) {
            mex(ex);
        }
    };
}

module.exports = {
    mga,
    merror,
    mex,
    mclick,
    mcatch,
};
