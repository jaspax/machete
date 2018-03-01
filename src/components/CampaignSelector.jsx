const React = require('react');
const PropTypes = require('prop-types');
const ErrorSink = require('./ErrorSink.jsx');
const Select = require('react-select').default;
require('react-select/dist/react-select.css');
const Async = require('react-promise').default;

const ga = require('../common/ga.js');

class CampaignSelector extends React.Component {
    render() {
        return <Async promise={this.props.campaignPromise} pending={this.pending()}
                then={this.then.bind(this)} catch={this.catch.bind(this)} />;
    }

    pending() {
        return <Select name="campaign-select" isLoading={true} />;
    }

    then(rawOptions) {
        this.rawOptions = rawOptions;
        const options = rawOptions.map((x, index) => ({ value: index, label: x.label }));
        const value = this.state ? this.state.value : null;
        return <Select name="campaign-select" className="machete-campaign-select"
            options={options} 
            onChange={this.onChange.bind(this)} 
            multi={true} 
            value={value} />;
    }

    catch(error) {
        return <ErrorSink error={error} />;
    }

    onChange(value) {
        if (!this.rawOptions)
            return;

        let selected = [];
        value.forEach(x => selected = selected.concat(...this.rawOptions[x.value].value));
        this.setState({ value });
        window.setTimeout(ga.mcatch(() => this.props.onChange(selected)));
    }
}

CampaignSelector.propTypes = {
    campaignPromise: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
};

module.exports = CampaignSelector;
