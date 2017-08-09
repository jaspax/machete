module.exports = function DataNotAvailable(props) {
    if (props.anonymous) {
        return (
            <div id="machete-chart-login-required">
                <p>You are not logged in to Machete, and reports for this campaign are
                not available to anonymous users.</p>
                
                <p><a data-mclick="thumbnail-login" href="https://machete-app.com/login" 
                target="_blank">Login to your Machete account</a> if you have created one.</p>

                <p><a data-mclick="thumbnail-create-acct" href="https://machete-app.com/login" 
                target="_blank">Create a Machete account</a> to subscribe.</p>
            </div>
        );
    }
    return (
        <div id="machete-chart-upgrade-required">
            <p>Reports for this campaign are not available under your current
            subscription.</p>
            
            <p><a data-mclick="thumbnail-upgrade" href="https://machete-app.com/profile" 
            target="_blank">Upgrade your account here</a>, then refresh this page.</p>
        </div>
    );
};
