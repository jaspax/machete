const React = require('react');
const PropTypes = require('prop-types');

class KeywordEnableToggle extends React.Component {
    constructor(props) {
        super(props);
        this.state = { changing: false };
        this.handleClick = this.handleClick.bind(this);
    }

    render() {
        if (this.state.changing) {
            return <div className="machete-kwstatus">
                <div className="loading-small"></div>
            </div>;
        }

        let buttonClass = 'ams-dropdown-status';
        let buttonText = '';
        if (this.props.enabled) {
            buttonClass += ' ams-status-active';
            buttonText = 'Enabled';
        }
        else {
            buttonClass += ' ams-status-paused';
            buttonText = 'Paused';
        }

        return (
            <div className="machete-kwstatus" title="Click to toggle">
                <span className="a-button a-button-small" onClick={this.handleClick}>
                    <span className="a-button-inner a-dropdown-status">
                        <span className="a-button-text">
                            <span className={buttonClass}></span>
                            <span>{buttonText}</span>
                        </span>
                    </span>
                </span>
            </div>
        );
    }

    handleClick() {
        this.setState({ changing: true });
        this.props.onChange(!this.props.enabled, () => {
            this.setState({ changing: false });
        });
    }

    componentWillReceiveProps() {
        this.setState({ changing: false });
    }
}

KeywordEnableToggle.propTypes = {
    enabled: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
};

module.exports = KeywordEnableToggle;
