const co = require('co');
const fs = require('fs');
const requestp = require('request-promise-native');
const readline = require('readline-sync');
const { spawn } = require('child_process');

if (require.main === module) {
    const argv = process.argv.slice(2);
    const releaseTag = argv.shift();

    let pkgPath = 'out/beta/machete-beta.zip';
    let appIds = ["adccehneljpgedjokmmbofllidphnjel", "ekcgmjhleflmfemjpeomblomcbhfnfcj"];
    if (releaseTag == 'release') {
        pkgPath = 'out/release/machete-release.zip';
        appIds = ["doggogocakpiacfoebkjgjolmpklkeha", "linbfabhpielmegmeckbhfadhnnjoack"];
    }

    co(function*() {
        try {
            console.log(`Publishing ${pkgPath} to apps ${appIds}`);
            const codes = yield* accessCode();

            for (const appId of appIds) {
                console.log('Requesting access token...');
                const token = yield* accessToken(codes);

                console.log(`Uploading to ${appId}...`);
                const uploadResult = yield* uploadPackage(appId, token, pkgPath);
                console.log('Upload result:', uploadResult);

                console.log(`Publishing ${appId}...`);
                const publishResult = yield* publishPackage(appId, token);
                console.log('Publish result:', publishResult);
            }

            console.log('Pushing and tagging current changes in git');
            yield* gitTag(releaseTag);
            yield* gitPush(releaseTag);

            process.exit(0);
        }
        catch (ex) {
            console.error(ex);
            process.exit(1);
        }
    });
}

function* asyncSpawn(cmd, args) {
    return yield new Promise((resolve, reject) => {
        console.log(cmd, args.join(' '));
        const child = spawn(cmd, args, { stdio: 'inherit' });
        child.on('close', code => {
            if (code == 0)
                return resolve();
            return reject('Error code: ' + code);
        });
    });
}

function* gitTag(releaseTag) {
    const manifest = require('./manifest.json');
    return yield* asyncSpawn('git', ['tag', '-f', `${releaseTag}-${manifest.version}`]);
}

function* gitPush(releaseTag) {
    yield* asyncSpawn('git', ['push', 'origin']);
    yield* asyncSpawn('git', ['push', 'origin', '--tags']);

    if (releaseTag == 'release') {
        yield* asyncSpawn('git', ['push', 'github']);
        yield* asyncSpawn('git', ['push', 'github', '--tags']);
    }
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
    const response = yield requestp({
        uri: 'https://www.googleapis.com/upload/chromewebstore/v1.1/items/' + appId,
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'x-goog-api-version': 2 },
        body: pkgBuffer
    });

    const status = JSON.parse(response);
    if (status.uploadState != 'SUCCESS')
        throw new Error(JSON.stringify(status));

    return status;
}

function* publishPackage(appId, token) {
    const response = yield requestp({
        uri: `https://www.googleapis.com/chromewebstore/v1.1/items/${appId}/publish`,
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'x-goog-api-version': 2 },
    });

    const status = JSON.parse(response);
    if (status.status[0] != 'OK')
        throw new Error(status.statusDetail.join('. '));
    return status;
}
