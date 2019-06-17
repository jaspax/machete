const React = require('react');
const PropTypes = require('prop-types');
const ga = require('../common/ga.js');

const DataNotAvailable = require('./DataNotAvailable.jsx');

function ErrorSink(props) {
    const error = props.error;

    if (error && error.handled) {
        return <DataNotAvailable reason={error.handled} />;
    }
    return <div className="machete-error machete-error-explain" style={{ width: "100%", height: "250px" }}>
        There was an error attempting to display the requested data.
        Please report this error by copying the error information below
        and sending it to <a href="mailto:support@machete-app.com?subject=Bug%20report">support@machete-app.com</a>.
        <textarea style={{ width: "100%", height: "150px" }} readOnly>
            {ga.errorToString(error)}
        </textarea>
    </div>;
}

ErrorSink.propTypes = { error: PropTypes.object.isRequired };

module.exports = ErrorSink;
