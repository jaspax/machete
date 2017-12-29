const co = require('co');
const fs = require('fs');
const requestp = require('request-promise-native');
const readline = require('readline-sync');

if (require.main === module) {
    const argv = process.argv.slice(2);
    const appId = argv.shift();
    const pkgPath = argv.shift();

    co(function*() {
        console.log(`Publishing ${pkgPath} to app ${appId}`);
        const codes = yield* accessCode();

        console.log('Requesting access token...');
        const token = yield* accessToken(codes);

        console.log('Uploading...');
        const uploadResult = yield* uploadPackage(appId, token, pkgPath);
        console.log('Upload result:', uploadResult);

        console.log('Publishing...');
        const publishResult = yield* publishPackage(appId, token);
        console.log('Publish result:', publishResult);
    });
}

function* accessCode() {
    const data = yield new Promise((resolve, reject) =>
        fs.readFile('../uploader-keys.json', 'utf8', (err, data) => (err && reject(err)) || resolve(data))
    );

    const codes = JSON.parse(data);
    console.log('Please visit the following URL to authorize this upload:');
    console.log(`     https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${codes.client_id}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`);
    const accessCode = readline.question('Enter the authorization code here: ');

    codes.access_code = accessCode;
    return codes;
}

function* accessToken(codes) {
    const response = yield requestp({
        uri: 'https://accounts.google.com/o/oauth2/token',
        method: 'POST',
        formData: {
            client_id: codes.client_id,
            client_secret: codes.client_secret,
            code: codes.access_code,
            grant_type: "authorization_code",
            redirect_uri: "urn:ietf:wg:oauth:2.0:oob"
        }
    });
    const token = JSON.parse(response);
    return token.access_token;
}

function* uploadPackage(appId, token, pkgPath) {
    const pkgBuffer = yield new Promise((resolve, reject) => fs.readFile(pkgPath, (err, data) => (err && reject(err)) || resolve(data)));
    const result = yield requestp({
        uri: 'https://www.googleapis.com/upload/chromewebstore/v1.1/items/' + appId,
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'x-goog-api-version': 2 },
        body: pkgBuffer
    });
    return JSON.parse(result);
}

function* publishPackage(appId, token) {
    const result = yield requestp({
        uri: `https://www.googleapis.com/chromewebstore/v1.1/items/${appId}/publish`,
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'x-goog-api-version': 2 },
    });
    return JSON.parse(result);
}
