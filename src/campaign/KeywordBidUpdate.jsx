const React = require('react');
const PropTypes = require('prop-types');

class KeywordBidUpdate extends React.Component {
    constructor(props) {
        super(props);
        this.state = { changing: false, bid: props.bid };
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
            <div className="machete-kwbid">
                <span>
                    <input type="text" maxLength="6" value={this.state.bid} onChange={this.handleChange}
                        className="a-input-text inplaceBidInput"></input>
                </span>
                <span className="a-button a-button-primary a-button-small" onClick={this.handleClick}>
                    <span className="a-button-inner">
                        <input name="save" className="a-button-input" type="submit" value="Save"></input>
                        <span className="a-button-text" aria-hidden="true">Save</span>
                    </span>
                </span>
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
