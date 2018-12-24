const React = require('react');
const PropTypes = require('prop-types');
const ErrorSink = require('./ErrorSink.jsx');
const ga = require('../common/ga.js');

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch(error, info) {
        ga.merror(error, info);
        this.setState({ hasError: true, error });
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
