const React = require('react');
const PropTypes = require('prop-types');

const ErrorBoundary = require('./ErrorBoundary.jsx');
const Popup = require('./Popup.jsx');
const TimeSeriesChart = require('./TimeSeriesChart.jsx');

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
        const dataPromise = this.props.dataPromiseFactory();
        this.setState({ show: true, dataPromise });
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
        mclick += ' ' + this.props.metric.prop;

        let ghost = null;
        if (this.props.latestData && this.props.allowed) {
            const metric = this.props.metric;
            const value = metric.format(this.props.latestData[metric.prop]);
            ghost = <div style={{float: 'left'}}><span className="machete-ghost">New: </span>{value}</div>;
        }

        return <div>
            {ghost}
            <div style={{float: 'right'}}>
                <a id={this.btnId} className={btnClasses} data-mclick={mclick} onClick={this.onChartClick}>
                    <img src={chartPng} />
                </a>
            </div>
            <ErrorBoundary>
                <Popup anchorId={this.btnId} show={this.state.show} onDismiss={this.onPopupDismissed}>
                    <TimeSeriesChart 
                        width={400} height={300} title={this.props.title} 
                        displayModeBar={false}
                        dataPromise={this.state.dataPromise} />
                </Popup>
            </ErrorBoundary>
        </div>;
    }
}

DashboardHistoryButton.chartClass = chartClass;
DashboardHistoryButton.propTypes = {
    allowed: PropTypes.bool.isRequired,
    anonymous: PropTypes.bool.isRequired,
    metric: PropTypes.object.isRequired,
    title: PropTypes.string.isRequired,
    dataPromiseFactory: PropTypes.func.isRequired,
    latestData: PropTypes.object,
};

module.exports = DashboardHistoryButton;
