const $ = require('jquery');
const common = require('../common/common.js');
const ga = require('../common/ga.js');

function tabber(tabs, opt) {
    let hasActivated = false;
    let tab = $(`<li className="a-tab-heading"><a href="#" >${opt.label}</a></li>`);
    let container = $(`<div class="a-box a-box-tab a-tab-content a-hidden" data-a-name="machete-${opt.label}"></div>`);
    if (opt.active) {
        tab.addClass('a-active');
        container.removeClass('a-hidden');
    }

    tab.find('a').click(ga.mcatch(() => {
        ga.mga('event', 'kword-data-tab', 'activate', opt.label);
        tab.addClass('a-active');
        tab.siblings().removeClass('a-active');
        tabs.parent().children('div').addClass('a-hidden');
        container.removeClass('a-hidden');

        if (opt.activate && !hasActivated) {
            hasActivated = true;
            window.setTimeout(() => opt.activate(common.getEntityId(), container));
        }
    }));

    if (!opt.insertIndex)
        tabs.append(tab);
    else
        $(tabs.children()[opt.insertIndex - 1]).after(tab);
    tabs.parent().append(container);
    return { tab, container };
}

module.exports = tabber;
