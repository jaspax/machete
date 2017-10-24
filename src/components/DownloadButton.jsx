const React = require('react');
const PropTypes = require('prop-types');

class DownloadButton extends React.Component {
    render() {
        return (
            <span className="a-button">
                <span className="a-button-inner">
                    <a className="a-button-text" role="button" href={this.props.href} title={this.props.title} onClick={this.props.onClick}>
                        <span className="download-icon"></span>&nbsp;Download
                    </a>
                </span>
            </span>
        );
    }
}

DownloadButton.propTypes = {
    href: PropTypes.string,
    onClick: PropTypes.func,
    title: PropTypes.string,
};

module.exports = DownloadButton;
