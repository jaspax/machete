const React = require('react');
const PropTypes = require('prop-types');
const ErrorSink = require('./ErrorSink.jsx');
const ga = require('../common/ga.js');

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        ga.merror(error, info);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorSink error={this.error} />;
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired };

module.exports = ErrorBoundary;
