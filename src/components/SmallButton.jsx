const React = require('react');
const PropTypes = require('prop-types');

function SmallButton(props) {
    return <span className="a-button a-button-primary a-button-small" onClick={props.onClick}>
        <span className="a-button-inner">
            <input name="save" className="a-button-input" type="submit" value={props.text}></input>
            <span className="a-button-text" aria-hidden="true">{props.text}</span>
        </span>
    </span>;
}

SmallButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    text: PropTypes.string.isRequired,
};

module.exports = SmallButton;
