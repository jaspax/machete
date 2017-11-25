const React = require('react');
const PropTypes = require('prop-types');

function StatusMessage(props) {
    const className = props.loading ? "loading-small" : "";

    return <div className="machete-status">
        <div className={className}></div>
        <p>{props.message}</p>
    </div>;
}

StatusMessage.propTypes = {
    loading: PropTypes.bool.isRequired,
    message: PropTypes.string,
};

module.exports = StatusMessage;
