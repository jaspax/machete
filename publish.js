const fs = require('fs');
const requestp = require('request-promise-native');
const readline = require('readline-sync');
const { spawn } = require('child_process');
const { google } = require('googleapis');

if (require.main === module) {
    const argv = process.argv.slice(2);
    const releaseTag = argv.shift();

    let pkgPath = 'out/beta/machete-beta.zip';
    let appIds = ["ekcgmjhleflmfemjpeomblomcbhfnfcj"];
    if (releaseTag == 'release') {
        pkgPath = 'out/release/machete-release.zip';
        appIds = ["linbfabhpielmegmeckbhfadhnnjoack"];
    }

    (async function() {
        try {
            console.log(`Publishing ${pkgPath} to apps ${appIds}`);

            const client = await authClient();

            for (const appId of appIds) {
                console.log('Requesting access token...');
                const token = await accessToken(client);

                console.log(`Uploading to ${appId}...`);
                const uploadResult = await uploadPackage(appId, token, pkgPath);
                console.log('Upload result:', uploadResult);

                console.log(`Publishing ${appId}...`);
                const publishResult = await publishPackage(appId, token);
                console.log('Publish result:', publishResult);
            }

            console.log('Pushing and tagging current changes in git');
            await gitTag(releaseTag);
            await gitPush(releaseTag);

            process.exit(0);
        }
        catch (ex) {
            console.error(ex);
            process.exit(1);
        }
    }());
}

function asyncSpawn(cmd, args) {
    return new Promise((resolve, reject) => {
        console.log(cmd, args.join(' '));
        const child = spawn(cmd, args, { stdio: 'inherit' });
        child.on('close', code => {
            if (code == 0)
                return resolve();
            return reject('Error code: ' + code);
        });
    });
}

function gitTag(releaseTag) {
    const manifest = require('./manifest.json');
    return asyncSpawn('git', ['tag', '-f', `${releaseTag}-${manifest.version}`]);
}

async function gitPush(releaseTag) {
    await asyncSpawn('git', ['push', 'origin']);
    await asyncSpawn('git', ['push', 'origin', '--tags']);

    if (releaseTag == 'release') {
        await asyncSpawn('git', ['push', 'github']);
        await asyncSpawn('git', ['push', 'github', '--tags']);
    }
}

function readAsync(fname) {
    return new Promise((resolve, reject) => fs.readFile(fname, 'utf8', (err, data) => (err && reject(err)) || resolve(data)));
}

async function authClient() {
    const data = await readAsync('../uploader-keys.json');
    const codes = JSON.parse(data);
    const oauthClient = new google.auth.OAuth2(codes.client_id, codes.client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauthClient.on('tokens', async tokens => {
        console.log('Storing new tokens');
        await new Promise((resolve, reject) => fs.writeFile('../uploader-tokens', JSON.stringify(tokens), err => (err && reject(err)) || resolve()));
    });
    return oauthClient;
}

async function accessToken(oauthClient) {
    try {
        const tokens = JSON.parse(await readAsync('../uploader-tokens'));
        await oauthClient.setCredentials(tokens);
        console.log('Using cached tokens');
        return tokens.access_token;
    }
    catch (ex) {
        console.warn(`Couldn't find cached tokens`);
    }

    const url = oauthClient.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/chromewebstore'] });

    console.log('Please visit the following URL to authorize this upload:');
    console.log(`  ${url}`);
    const accessCode = readline.question('Enter the authorization code here: ');
    const { tokens } = await oauthClient.getToken(accessCode);
    return tokens.access_token;
}

async function uploadPackage(appId, token, pkgPath) {
    const pkgBuffer = await new Promise((resolve, reject) => fs.readFile(pkgPath, (err, data) => (err && reject(err)) || resolve(data)));
    const response = await requestp({
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

async function publishPackage(appId, token) {
    const response = await requestp({
        uri: `https://www.googleapis.com/chromewebstore/v1.1/items/${appId}/publish`,
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'x-goog-api-version': 2 },
    });

    const status = JSON.parse(response);
    if (status.status[0] != 'OK')
        throw new Error(status.statusDetail.join('. '));
    return status;
}
