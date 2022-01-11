const Mustache = require('mustache');
const portalLib = require('@mojaloop/finance-portal-lib');

/**
 * @function getSearchQuery
 * @param {Object} config Azure configuration parameters.
 * @param {String} transferId Id of the target transfer.
 * @param {Object} log logging module used by the system.
 * @returns {String}
 */
function getSearchQuery(config, transferId, log) {
    try {
        return Mustache.render(config.searchQueryTemplate.template, { transferId });
    } catch (e) {
        log(e);

        throw e;
    }
}

/**
 * @function getClientCredentialToken
 * @param {Object} config Azure configuration parameters.
 * @param {Object} log logging module used by the system.
 * @returns {String} Access token required to access the Azure Log Analytics REST API resource.
 */
async function getClientCredentialToken(config, log) {
    const url = portalLib.requests.buildUrl(config.tenantId, 'oauth2', 'token');
    const body = `grant_type=${config.grantType}&client_id=${config.clientId}&redirect_uri=${config.redirectURI}&resource=${config.resource}&client_secret=${config.clientSecret}`;
    const opts = {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        json: false,
        endpoint: config.logApiEndpoint,
        logger: log,
    };

    const result = await portalLib.requests.post(url, body, opts);

    return result && result.access_token ? result.access_token : null;
}

/**
 * @function getTransferMessageWithJWSSignature
 * @param {Object} config Azure configuration parameters.
 * @param {String} transferId Id of the target transfer.
 * @param {Object} log logging module used by the system.
 * @returns {String} the JWS signature for a given transferId.
 */
const getTransferMessageWithJWSSignature = async (config, transferId, log) => {
    const token = await getClientCredentialToken(config, log);

    const url = portalLib.requests.buildUrl('workspaces', config.workspaceId, 'query');
    const query = getSearchQuery(config, transferId, log);
    const body = { query };
    const opts = {
        headers: {
            Authorization: `Bearer ${token}`,
            'content-type': 'application/json',
        },
        endpoint: config.logApiEndpoint,
        logger: log,
    };

    const result = await portalLib.requests.post(url, body, opts);
    const tables = result && result.tables;
    const rows = tables && tables[0].rows;
    const data = rows && rows[0] && rows[0][0];

    if (!data) {
        return null;
    }

    const messagePattern = new RegExp(config.kafkaMessagePattern);
    const match = data.match(messagePattern);
    let cleanMessage = (Array.isArray(match) && match.length > 0)  && match[1];

    if (!cleanMessage) {
        return null;
    }

    config.cleanMessageReplacePatterns.forEach((item) => {
        const re = new RegExp(item.pattern, item.attributes);

        cleanMessage = cleanMessage.replace(re, item.replace);
    });

    const jsonData = JSON.parse(cleanMessage);
    if (jsonData && jsonData.content && jsonData.content.headers && jsonData.content.headers['fspiop-signature']) {
        let signatureHeader = jsonData.content.headers['fspiop-signature'];
        config.cleanSignatureReplacePatterns.forEach((item) => {
            const re = new RegExp(item.pattern, item.attributes);

            signatureHeader = signatureHeader.replace(re, item.replace);
        });

        return {
            signatureHeader: JSON.parse(signatureHeader),
            message: jsonData,
        };
    }

    return null;
};

module.exports = {
    getTransferMessageWithJWSSignature,
};
