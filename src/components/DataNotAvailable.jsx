const React = require('react');
const PropTypes = require('prop-types');

const constants = require('../common/constants.js');
const href = `https://${constants.hostname}/profile`;

function DataNotAvailable(props) {
    if (props.anonymous) {
        return (
            <div className="machete-login-required">
                <p><a data-mclick="thumbnail-login" href={href}
                target="_blank">Log in to Machete</a> to display data for this campaign.</p>
            </div>
        );
    }
    return (
        <div className="machete-upgrade-required">
            <p>Reports for this campaign are not available under your current
            subscription.</p>
            
            <p><a data-mclick="thumbnail-upgrade" href={href}
            target="_blank">Upgrade your account here</a>, then refresh this page.</p>
        </div>
    );
}

DataNotAvailable.propTypes = { anonymous: PropTypes.bool.isRequired };

module.exports = DataNotAvailable;
