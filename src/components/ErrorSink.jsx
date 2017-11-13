const React = require('react');
const PropTypes = require('prop-types');
const ga = require('../common/ga.js');

const DataNotAvailable = require('./DataNotAvailable.jsx');

function ErrorSink(props) {
    const error = props.error;

    if (error.handled) {
        if (error.authError) {
            return <DataNotAvailable owned={!error.notOwned} allowed={!error.notAllowed} anonymous={!!error.notLoggedIn} />;
        }
        return <div className="machete-error">
            <div className="machete-error-explain">
                There was an error attempting to display the requested data.
                An error report has been automatically generated and sent to
                our support address. You may try again in a few minutes.
            </div>
        </div>;
    }
    return <div className="machete-error">
        <div className="machete-error-explain">
            There was an error attempting to display the requested data.
            Please report this error by copying the error information below
            and sending it to <a href="mailto:support@machete-app.com?subject=Bug%20report">support@machete-app.com</a>.
        </div>
        <pre>
            {ga.errorToString(error)}
        </pre>
    </div>;
}

ErrorSink.propTypes = { error: PropTypes.object.isRequired };

module.exports = ErrorSink;
