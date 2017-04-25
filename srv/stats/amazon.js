/* jshint node: true */
'use strict';

var page = require('webpage').create();

console.log("trying to open ams.amazon.com");
page.open('https://ams.amazon.com/', function(stat) {
    console.log("opened a thing");
    if (stat != 'success') {
        console.log("Failure opening https://ams.amazon.com - " + stat);
        phantom.exit();
    }
    page.evaluate(function() {
        console.log("trying to evaluate");
        return document.getElementById('topNavLinkSignIn').href;
    }, function(err, signinUrl) {
        if (err) {
            console.log(err);
            phantom.exit();
        }
        console.log("trying to open "+signinUrl);
        page.open(signinUrl, function(stat) {
            if (stat != 'success') {
                console.log("Failure opening " +signinUrl + " - " + stat);
                phantom.exit();
            }
            page.evaluate(function() {
                document.getElementById('ap_email').value = 'jsbangs@gmail.com';
                document.getElementById('ap_password').value = 'NePP3O07L@3y';
                document.getElementById('ap_signin_form').submit();
            }, function(err) {
                if (err) {
                    console.log(err);
                    phantom.exit();
                }
                console.log("waiting for login form load");
                page.onLoadFinished = function(stat) {
                    if (stat != 'success') {
                        console.log("Failure logging in - " + stat);
                        phantom.exit();
                    }
                    if (page.url.test(/ap\/mfa/)) {
                        var rl = readline.createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });
                        rl.question("Enter the Amazon confirmation code on your phone", function(code) {
                            rl.close();
                            page.evaluate(function() {
                                document.getElementById('auth-mfa-otpcode').value = code;
                                document.getElementByid('auth-mfa-form').submit();
                            }, function(err) {
                                console.log("waiting for mfa form load");
                                page.onLoadFinished = function(stat) {
                                    phantom.exit();
                                    return page.cookies;
                                };
                            });
                        });
                    }
                    else {
                        return page.cookies;
                    }
                };
            });
        });
    });
});
