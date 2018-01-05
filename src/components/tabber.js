const $ = require('jquery');
const ga = require('../common/ga.js');

function tabber(tabs, opt) {
    let tab = $(`<li className="a-tab-heading"><a href="#" >${opt.label}</a></li>`);
    let container = $(`<div class="a-box a-box-tab a-tab-content a-hidden" data-a-name="machete-${opt.label}"></div>`);

    if (opt.insertIndex)
        $(tabs.children()[opt.insertIndex - 1]).after(tab);
    else
        tabs.append(tab);
    tabs.parent().append(container);

    if (opt.active || isActiveTab(opt.label)) {
        activate({ evt: null, tabs, tab, container, opt });
    }
    tab.find('a').click(ga.mcatch((evt) => activate({ evt, tabs, tab, container, opt })));

    return { tab, container };
}

function activate(arg) {
    const { evt, tabs, tab, container, opt } = arg;
    if (evt)
        evt.preventDefault();

    ga.mga('event', 'kword-data-tab', 'activate', opt.label);

    tab.addClass('a-active');
    tab.siblings().removeClass('a-active');
    tabs.parent().children('div').addClass('a-hidden');
    container.removeClass('a-hidden');

    window.history.pushState({ activeTab: opt.label }, '', getTabUrl(opt.label));

    if (opt.activate && !opt.hasActivated) {
        opt.hasActivated = true;
        window.setTimeout(ga.mcatch(() => opt.activate(container)));
    }
}

function getTabUrl(label, location = window.location.href) {
    const url = new URL(location);
    url.searchParams.set('macheteTab', label);
    return url.toString();
}

function isActiveTab(label, location = window.location.href) {
    const url = new URL(location);
    return url.searchParams.get('macheteTab') == label;
}

module.exports = tabber;
