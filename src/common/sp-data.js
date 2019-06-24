function stripPrefix(id) {
    if (!id)
        return id;
    if (!id.replace)
        return id;
    return id.replace(/^AX?/, '');
} 

// take a uri like host.com/foo/1/ and extract the "1" given "foo"
function getUriPathChunk(href, chunk) {
    let path = href.split('?')[0];
    let parts = path.split('/');
    let nameIndex = parts.indexOf(chunk);
    if (nameIndex >= 0) {
        return parts[nameIndex + 1];
    }
    return null;
}

function getAdGroupIdFromDOM(dom) {
    const adGroupIdInput = dom.querySelector('input[name=adGroupId]');
    if (adGroupIdInput)
        return stripPrefix(adGroupIdInput.value);

    const sspaLink = dom.querySelector('.page-container nav li a');
    if (sspaLink)
        return stripPrefix(getUriPathChunk(sspaLink.href, 'ad-groups'));

    const scripts = dom.querySelectorAll('script');
    for (const script of scripts) {
        const match = script.innerText.match(/adGroupId: *"(.*)"/);
        if (match) {
            return match[1];
        }
    }

    return null;
}

module.exports = {
    stripPrefix,
    getUriPathChunk,
    getAdGroupIdFromDOM,
};
