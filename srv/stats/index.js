/* jshint node: true */
let phantom = require('phantomjs');
let node_phantom = require('node-phantom');
let readline = require('readline');

function main() {
    phantomCookies(undefined, undefined, (err, cookies) => {
        if (err)
            console.error(err);
        console.log(cookies);
    });
}

if (require.main === module) { 
    main(); 
}

function phantomCookies(username, password, cb) {
    console.log("trying to create phantomjs");
    node_phantom.create((err, ph) => {
        if (!ph)
            return cb("couldn't create phantomjs");
        return ph.createPage((err, page) => {
            if (err) 
                return cb(err);
            console.log("trying to open ams.amazon.com");
            page.open('https://ams.amazon.com/', status => {
                if (status != 'success')
                    return cb("Failure opening https://ams.amazon.com");
                page.evaluate(() => {
                    return document.getElementById('topNavLinkSignIn').href;
                }, (err, signinUrl) => {
                    if (err)
                        return cb(err);
                    console.log("trying to open "+signinUrl);
                    page.open(signinUrl, status => {
                        if (status != 'success')
                            return cb("Failure opening " +signinUrl);
                        page.evaluate(() => {
                            document.getElementById('ap_email').value = 'jsbangs@gmail.com';
                            document.getElementById('ap_password').value = 'NePP3O07L@3y';
                            document.getElementById('ap_signin_form').submit();
                        }, (err) => {
                            if (err)
                                return cb(err);
                            console.log("waiting for login form load");
                            page.onLoadFinished = status => {
                                if (status != 'success')
                                    return cb("Failure loading after submitting form");
                                if (page.url.test(/ap\/mfa/)) {
                                    const rl = readline.createInterface({
                                        input: process.stdin,
                                        output: process.stdout
                                    });
                                    rl.question("Enter the Amazon confirmation code on your phone", code => {
                                        rl.close();
                                        page.evaluate(() => {
                                            document.getElementById('auth-mfa-otpcode').value = code;
                                            document.getElementByid('auth-mfa-form').submit();
                                        }, (err) => {
                                            console.log("waiting for mfa form load");
                                            page.onLoadFinished = status => {
                                                cb(err, page.cookies);
                                            };
                                        });
                                    });
                                }
                                else {
                                    cb(err, page.cookies);
                                }
                            };
                        });
                    });
                });
            });
        });
    }, { phantomPath: phantom.path });
}

