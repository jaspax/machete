const React = require('react');
const PropTypes = require('prop-types');
const ga = require('../common/ga.js');

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch(error, info) {
        ga.merror(error, info);
        this.setState({ hasError: true });
    }

    render() {
        if (this.state.hasError) {
            return <div className="machete-upgrade-required">
                <p>Machete encountered an error attempting to display this data.
                    An error report has automatically been generated and sent to
                    our servers.</p>
                <p>You may refresh your page and try again.</p>
            </div>; 
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired };

module.exports = ErrorBoundary;
