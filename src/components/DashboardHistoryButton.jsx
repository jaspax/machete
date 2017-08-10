const React = require('react');
const PropTypes = require('prop-types');
const HistoryChartPopup = require('./HistoryChartPopup.jsx');

const chartPng = chrome.runtime.getURL('images/chart-16px.png');
const chartClass = `machete-chart-btn`;
const chartClassDisabled = `machete-chart-btn-disabled`;

class DashboardHistoryButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = { show: false };
        this.btnId = `DashboardHistoryButton${Date.now()}`;
        this.onChartClick = this.onChartClick.bind(this);
        this.onPopupDismissed = this.onPopupDismissed.bind(this);
    }

    onChartClick() {
        this.setState({ show: true });
    }

    onPopupDismissed() {
        this.setState({ show: false });
    }

    render() {
        let btnClasses = chartClass;
        let mclick = 'thumbnail-enabled';
        if (!this.props.allowed) {
            btnClasses += ' ' + chartClassDisabled;
            mclick = 'thumbnail-disabled';
        }
        mclick += ' ' + this.props.metric;

        this.chart = <HistoryChartPopup 
            show={this.state.show}
            onDismiss={this.onPopupDismissed}
            anchorId={this.btnId}
            allowed={this.props.allowed}
            anonymous={window.user.isAnon}
            name={this.props.name}
            metric={this.props.metric}
            label={this.props.label}
            data={this.props.data}
            timestamps={this.props.timestamps}
        />;

        return <span>
            <a id={this.btnId} className={btnClasses} data-mclick={mclick} onClick={this.onChartClick}>
                <img src={chartPng} />
            </a>
            {this.chart}
        </span>;
    }
}

DashboardHistoryButton.chartClass = chartClass;
DashboardHistoryButton.propTypes = {
    allowed: PropTypes.bool.isRequired,
    metric: PropTypes.string.isRequired,
    timestamps: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
};


module.exports = DashboardHistoryButton;
