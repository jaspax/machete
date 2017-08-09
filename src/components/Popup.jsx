const React = require('react');
const $ = require('jquery');
const ga = require('../common/ga.js');

/* For now, we are assuming that the popup is anchored on something which is NOT
 * itself a React element. If this assumption becomes false in the future, we
 * may need to revisit this.
 */

const width = 420;
const height = 320;
const gutter = 6;

module.exports = class Popup extends React.Component {
    constructor(props) {
        super(props);
        this.anchor = $(props.anchor);
        this.state = { show: props.show };
    }

    render() {
        if (!this.state.show)
            return null;

        let anchorPos = this.anchor.position();
        let pos = {top: anchorPos.top + this.anchor.height() + gutter, left: anchorPos.left};
        if (anchorPos.left + width > $(document).width()) { 
            pos = {top: anchorPos.top + this.anchor.height() + gutter, left: anchorPos.left + this.anchor.width() - width + gutter};
        }

        // Clicking anywhere outside the popup dismisses the chart
        const self = this;
        $(document).on('click.machete.popup-dismiss', ga.mcatch(function() {
            if (!$.contains(self.popup, this)) {
                ga.mga('event', 'popup', 'dismiss');
                self.hide();
                $(document).off('click.machete.popup-dismiss');
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
            <div className="machete-popup" 
              ref={ (popup) => { this.popup = popup; } }
              style={{ top: pos.top, left: pos.left }}>
                {this.props.children}
            </div>
        );
    }

    show() {
        this.setState({show: true});
    }

    hide() {
        this.setState({show: false});
    }
};
