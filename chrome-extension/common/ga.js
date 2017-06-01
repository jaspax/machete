/* eslint-disable no-unused-vars */

// execute a function in the context of the hosting page
function inpage(fn, args) {
    var script = document.createElement('script');
    var sargs = JSON.stringify(args);
    var text = `(${fn.toString()}).apply(null, ${sargs});`;
    script.textContent = text;
    document.documentElement.appendChild(script);
    document.documentElement.removeChild(script);
}

// add Universal Analytics to the page
/* eslint-disable */
inpage(function () {
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o);
    a.async=1;a.src=g;document.documentElement.appendChild(a)
    })(window,document,'script','//www.google-analytics.com/analytics.js','__ga');
});

inpage(function () {
	__ga('create', 'UA-98724833-1', 'auto', 'machete');
	__ga('machete.send', 'pageview', location.pathname);
});
/* eslint-enable */

function mga(...args) {
    inpage(function(...a) {
        __ga.apply(null, a);
    }, ['machete.send'].concat(args));
}

// This is next to useless, but at least we'll get *something*
window.onerror = function(errorMsg, url, lineNumber) {
    inpage(function(_errorMsg, _url, _lineNumber) {
        __ga('machete.send', 'exception', { exDescription: `${_errorMsg}; ${_url}:${_lineNumber}`, exFatal: true });
    }, [errorMsg, url, lineNumber]);
};

function merror(...msg) {
    let error = new Error(msg.join(' '));
    mex(new Error(msg), false);
    console.error(msg);
    return error;
}

function mex(ex, fatal) {
    mga('exception', { exDescription: ex.stack, exFatal: fatal });
}

function mclick(category, label) {
    mga('event', category, 'click', label);
}

$(document).on('click.machete.ga', '[data-mclick]', function() {
    const args = $(this).attr('data-mclick').split(' ');
    let category = args[0];
    let label = args[1] || this.id;
    mclick(category, label);
    return true;
});
