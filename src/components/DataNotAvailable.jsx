const React = require('react');
const PropTypes = require('prop-types');

const constants = require('../common/constants.js');
const sp = require('../common/sp-data.js');
const href = `https://${constants.hostname}/profile`;
const request = `https://${constants.hostname}/share/request/start?entityId=`;

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
        const entityId = sp.getEntityId();
        return <div className="machete-upgrade-required">
            <p>We&#8217;re not sure if you&#8217;re supposed to see this account&#8217;s Machete data.</p>

            <p><a data-mclick="thumbnail-share-request" href={request + entityId}
                    target="_blank">Click here to learn more and request access from the account owner.</a></p>

        </div>;
    }
    else if (props.reason == 'serverError') {
        return <div className="machete-upgrade-required">
            <p>The Machete server encountered an error trying to handle this request. Try again in a few minutes.</p>
        </div>;
    }
    else if (props.reason == 'incognito') {
        return <div className="machete-upgrade-required">
            <p>Machete does not work in incognito mode. Try reloading your AMS
                page in a regular browser window.</p>
        </div>;
    }
    else if (props.reason == 'networkError') {
        return <div className="machete-upgrade-required">
            <p>Machete could not display this data due to a network error.</p>

            <p>Check that there is no privacy software or ad-blocker which is
                blocking amazon.com or machete-app.com, then try reloading your
                browser page.</p>
        </div>; 
    }

    return <div className="machete-upgrade-required">
        <p>Machete cannot display this data right now.</p>
    </div>;
}

DataNotAvailable.propTypes = { reason: PropTypes.string.isRequired };

module.exports = DataNotAvailable;
