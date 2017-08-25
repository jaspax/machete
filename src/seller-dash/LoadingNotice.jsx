const React = require('react');

const className = 'machete-loading-notice';

function LoadingNotice() {
    const spinnerStyle = {
        width: '14px',
        height: '15px',
        display: 'inline-block',
        marginRight: '8px',
    };
    return <div className={className}>
        <div className="loading-small" style={spinnerStyle}></div>
        Machete is syncing your campaign data. This may take a while.
    </div>;
}

LoadingNotice.className = className;

module.exports = LoadingNotice;
