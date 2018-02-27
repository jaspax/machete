const React = require('react');
const PropTypes = require('prop-types');
const $ = require('jquery');
const ga = require('../common/ga.js');
const Portal = require('react-portal');

/* For now, we are assuming that the popup is anchored on something which is NOT
 * itself a React element. If this assumption becomes false in the future, we
 * may need to revisit this.
 */

const width = 420;
const gutter = 6;
const dismissEvent = 'click.machete.popup-dismiss';

let popupCounter = 0;

class Popup extends React.Component {
    render() {
        if (!this.props.show) {
            $(document).off(dismissEvent);
            if (this.target) {
                this.target.remove();
            }
            return null;
        }

        popupCounter++;
        const popupId = 'machete-popup-' + popupCounter;
        this.target = $(`<div id="${popupId}" class="machete-popup"></div>`);
        $(document.body).append(this.target);

        const anchor = $('#'+this.props.anchorId);
        let anchorPos = anchor.offset();
        let pos = {top: anchorPos.top + anchor.height() + gutter, left: anchorPos.left};
        if (anchorPos.left + width > $(document).width()) { 
            pos = {top: anchorPos.top + anchor.height() + gutter, left: anchorPos.left + anchor.width() - width + gutter};
        }
        this.target.css(pos);

        // Clicking anywhere outside the popup dismisses the chart. We bind the
        // event here, and unbind it when we're actually re-rendered with
        // show=false.
        const self = this;
        $(document).on(dismissEvent, ga.mcatch(function() {
            if (!$.contains(self.target, this)) { // eslint-disable-line no-invalid-this
                ga.mga('event', 'popup', 'dismiss');
                if (self.props.onDismiss) {
                    self.props.onDismiss();
                }
            }
        }));

        /* TODO: animate this shit
        const bodyTop = $('body').scrollTop();
        const bodyLeft = $('body').scrollLeft();

        popup.slideDown(200, function() {
            $('body').scrollTop(bodyTop);
            $('body').scrollLeft(bodyLeft);
        });
        */

        return (
            <Portal id={popupId}>
                {this.props.children}
            </Portal>
        );
    }
}

Popup.propTypes = {
    anchorId: PropTypes.string.isRequired,
    show: PropTypes.bool,
    onDismiss: PropTypes.func.isRequired,
    children: PropTypes.node,
};

module.exports = Popup;
