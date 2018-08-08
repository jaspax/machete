const $ = require('jquery');
const ga = require('../common/ga.js');

function tabber(tabs, opt) {
    let detachedChildren = null;

    // tabs could be the actual UL with the tab names, or it could be the
    // wrapper around which we want to put the tabs.
    if (tabs.prop('tagName') != 'UL') {
        const firstChild = tabs.children().first();
        if (firstChild.prop('tagName') == 'UL') {
            tabs = firstChild;
        }
        else {
            const wrapper = tabs;
            detachedChildren = wrapper.children().detach();

            tabs = $('<ul class="a-tabs a-declarative"></ul>');
            wrapper.append(tabs);
            wrapper.addClass('a-tab-container');
        }
    }

    let hasActivated = false;
    let tab = $(`<li class="a-tab-heading machete-tab"><a href="#" >${opt.label}</a></li>`);
    let container = $(`<div class="a-box a-box-tab a-tab-content a-hidden" data-a-name="machete-${opt.label}"></div>`);
    if (opt.active) {
        tab.addClass('a-active');
        container.removeClass('a-hidden');
    }

    tab.find('a').click(ga.mcatch((evt) => {
        evt.preventDefault();
        ga.mga('event', 'kword-data-tab', 'activate', opt.label);

        tab.addClass('a-active');
        tab.siblings().removeClass('a-active');
        tabs.parent().children('div').addClass('a-hidden');
        container.removeClass('a-hidden');

        if (opt.activate && !hasActivated) {
            hasActivated = true;
            window.setTimeout(ga.mcatch(() => opt.activate(container)));
        }
    }));

    if (opt.insertIndex && opt.insertIndex < tabs.children().length)
        $(tabs.children()[opt.insertIndex - 1]).after(tab);
    else
        tabs.append(tab);
    tabs.parent().append(container);

    if (detachedChildren) {
        container.append(detachedChildren);
    }
    return { tab, container };
}

module.exports = tabber;
