// TODO: Remove previous line and work through linting issues at next edit
const fetch = require('node-fetch');
const https = require('https');

const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

const ALLOWED_ROLES = ['Application/mfp-ndc-rw'];

const permit = async (userInfoURL, token, requestMethod, requestPath, log) => {
    // const isAllowed = role => allowed.indexOf(role) > -1;
    const opts = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        agent: selfSignedAgent,
    };
    const userinfo = await fetch(userInfoURL, opts).then(res => res.json());
    log('Got userinfo:', userinfo);

    const usergroups = userinfo.groups ? userinfo.groups.split(',') : [];
    if (requestPath.includes('netdebitcap') && requestMethod === 'POST') {
        // the roles in WSO2 IS some times appear all UPPERCASE and sometimes just Capitalized
        // so we better perform a case insensitive comparison since this is what WSO2 IS also does
        if (ALLOWED_ROLES.some(allowedRole => usergroups
            .map(userGroup => userGroup.toLowerCase())
            .includes(allowedRole.toLowerCase()))) {
            return true;
        }

        log('net debit cap update - user not authorised');
        return false;
    }

    return true;
};

module.exports = { permit };
