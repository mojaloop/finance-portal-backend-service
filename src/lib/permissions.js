const fetch = require('node-fetch');
const https = require('https');

const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

const ALLOWED_ROLES = ['ndc_update'];

const permit = async (userInfoURL, token, requestMethod, requestPath, log) => {
    const opts = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        agent: selfSignedAgent,
    };
    const userinfo = await fetch(userInfoURL, opts).then((res) => res.json());
    log.info(`Got userinfo: ${userinfo}`);

    const usergroups = userinfo.groups ? userinfo.groups.split(',') : [];
    if (requestPath.includes('netdebitcap') && requestMethod === 'POST') {
        // the roles in WSO2 IS some times appear all UPPERCASE and sometimes just Capitalized
        // so we perform a case insensitive comparison since this is what WSO2 IS also does
        if (ALLOWED_ROLES.some((allowedRole) => usergroups
            .map((userGroup) => userGroup.toLowerCase())
            .includes(allowedRole.toLowerCase()))) {
            return true;
        }

        log.warn('net debit cap update - user not authorised');
        log.warn('required role, one of:', ALLOWED_ROLES);
        log.warn('user roles:', usergroups);
        return false;
    }

    return true;
};

module.exports = { permit };
