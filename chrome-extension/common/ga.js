// simple helper function
function inpage(fn, args) {
    var script = document.createElement('script');
    var sargs = JSON.stringify(args);
    var text = `(${fn.toString()}).apply(null, ${sargs});`;
    script.textContent = text;
    document.documentElement.appendChild(script);
    document.documentElement.removeChild(script);
}

// add Universal Analytics to the page
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

function ga() {
    inpage(function() {
        __ga.apply(null, arguments);
    }, Array.from(arguments));
}

// This is next to useless, but at least we'll get *something*
window.onerror = function(errorMsg, url, lineNumber) {
    inpage(function(_errorMsg, _url, _lineNumber) {
        __ga('machete.send', 'exception', { exDescription: `${_errorMsg}; ${_url}:${_lineNumber}`, exFatal: true });
    }, [errorMsg, url, lineNumber]);
}

function merror(msg) {
    let error = new Error(msg);
    mex(new Error(msg), false);
    return error;
}

function mex(ex, fatal) {
    ga('machete.send', 'exception', { exDescription: ex.stack, exFatal: fatal });
}

function mclick(category, label, fn) {
    ga('machete.send', 'event', category, 'click', label);
    if (fn)
        fn();
}

$(document).on('click', '[data-mclick]', function() {
    const args = this.attr('data-mclick').split(' ');
    mclick(args[0], args[1]);
    return true; // continue as before
});
