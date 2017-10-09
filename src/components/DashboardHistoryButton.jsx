const React = require('react');
const PropTypes = require('prop-types');
const HistoryChartPopup = require('./HistoryChartPopup.jsx');

const chartPng = chrome.runtime.getURL('images/chart-16px.png');
const chartClass = `machete-chart-btn`;
const chartClassDisabled = `machete-chart-btn-disabled`;

class DashboardHistoryButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            show: false, 
            dataPromise: Promise.resolve({ timestamp: [], data: [], name: '' }),
        };
        this.btnId = `DashboardHistoryButton${Date.now()}`;
        this.onChartClick = this.onChartClick.bind(this);
        this.onPopupDismissed = this.onPopupDismissed.bind(this);
    }

    onChartClick() {
        this.setState({ 
            show: true,
            dataPromise: this.props.dataPromiseFactory(),
        });
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

        return <span>
            <a id={this.btnId} className={btnClasses} data-mclick={mclick} onClick={this.onChartClick}>
                <img src={chartPng} />
            </a>
            <HistoryChartPopup 
                show={this.state.show}
                onDismiss={this.onPopupDismissed}
                anchorId={this.btnId}
                allowed={this.props.allowed}
                anonymous={this.props.anonymous}
                title={this.props.title}
                dataPromise={this.state.dataPromise}
            />
        </span>;
    }
}

DashboardHistoryButton.chartClass = chartClass;
DashboardHistoryButton.propTypes = {
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    metric: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    dataPromiseFactory: PropTypes.func.isRequired,
};

module.exports = DashboardHistoryButton;
