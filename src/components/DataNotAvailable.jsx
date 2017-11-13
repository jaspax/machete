const React = require('react');
const PropTypes = require('prop-types');

const constants = require('../common/constants.js');
const href = `https://${constants.hostname}/profile`;

function DataNotAvailable(props) {
    if (props.reason == 'notLoggedIn') {
        return (
            <div className="machete-login-required">
                <p><a data-mclick="thumbnail-login" href={href}
                target="_blank">Log in to Machete</a> to display data for this campaign.</p>
            </div>
        );
    }
    else if (props.reason == 'notAllowed') {
        return (
            <div className="machete-upgrade-required">
                <p>Reports for this campaign are not available under your current
                subscription.</p>
                
                <p><a data-mclick="thumbnail-upgrade" href={href}
                target="_blank">Upgrade your account here</a>, then refresh this page.</p>
            </div>
        );
    }
    else if (props.reason == 'notOwned') {
        return <div className="machete-upgrade-required">
            <p>This Machete account does not own this campaign data. Ensure that you
                are logged in under the correct Machete account.</p>

            <p><a data-mclick="thumbnail-profile" href={href}
                    target="_blank">Check your current account and log out if
                    necessary</a>, then refresh this page when you have switched
                Machete accounts.</p>

        </div>;
    }

    return <div className="machete-upgrade-required">
        <p>Machete cannot display this data right now.</p>
    </div>;
}

DataNotAvailable.propTypes = { reason: PropTypes.string.isRequired };

module.exports = DataNotAvailable;
