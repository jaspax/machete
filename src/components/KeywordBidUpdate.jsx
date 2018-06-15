const React = require('react');
const PropTypes = require('prop-types');

const common = require('../common/common.js');

const SmallButton = require('./SmallButton.jsx');

class KeywordBidUpdate extends React.Component { // eslint-disable-line react/no-deprecated
    constructor(props) {
        super(props);
        this.state = { changing: false, bid: common.numberFmt(props.bid) };
        this.handleClick = this.handleClick.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    render() {
        if (this.state.changing) {
            return <div className="machete-kwbid">
                <div className="loading-small"></div>
            </div>;
        }

        return (
            <div className="machete-kwbid sspa-editor-input-container">
                <span>
                    <input type="text" maxLength="6" value={this.state.bid} onChange={this.handleChange}
                        className="a-input-text machete-small-input"></input>
                </span>
                <SmallButton text="Save" onClick={this.handleClick.bind(this)} />
            </div>
        );
    }

    handleClick() {
        this.setState({ changing: true });
        this.props.onChange(this.state.bid);
    }

    handleChange(e) {
        this.setState({ bid: e.target.value });
    }

    componentWillReceiveProps(nextProps) {
        this.setState({ changing: false, bid: nextProps.bid });
    }
}

KeywordBidUpdate.propTypes = {
    bid: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
};

module.exports = KeywordBidUpdate;
