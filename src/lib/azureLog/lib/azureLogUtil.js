/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

'use strict';

const fetch = require('node-fetch');
const util = require('util');
const Config = require('./config');
const Mustache = require('mustache');


const respErrSym = Symbol('ResponseErrorDataSym');

class HTTPResponseError extends Error {
    constructor(params) {
        super(params.msg);
        this[respErrSym] = params;
    }

    getData() {
        return this[respErrSym];
    }

    toString() {
        return util.inspect(this[respErrSym]);
    }

    toJSON() {
        return JSON.stringify(this[respErrSym]);
    }
}

// Simple logging function. Should replace this with structured logging.
const log = (...args) => {
    console.log(`[${(new Date()).toISOString()}]`, ...args);
};



// Strip all beginning and end forward-slashes from each of the arguments, then join all the
// stripped strings with a forward-slash between them. If the last string ended with a
// forward-slash, append that to the result.
const buildUrl = (...args) => args
    .filter(e => e !== undefined)
    .map(s => s.replace(/(^\/*|\/*$)/g, '')) /* This comment works around a problem with editor syntax highglighting */
    .join('/')
    + ((args[args.length - 1].slice(-1) === '/') ? '/' : '');

const optLog = (opts, ...args) => {
    if (opts && opts.logger) {
        opts.logger(...args);
    }
};

const throwOrJson = async (res, msg = 'HTTP request returned error response') => {
    if (res.headers.get('content-length') === '0' || res.status === 204) {
        return null;
    }
    const resp = await res.json();
    if (res.ok) {
        return resp;
    }
    throw new HTTPResponseError({ msg, res, resp });
};



async function post(url, headers, body, opts) {
    try {
        const reqOpts = {
            method: 'POST',
            headers,
            body: (typeof body !== 'string') ? JSON.stringify(body) : body
        };
        return await fetch(buildUrl(opts.endpoint, url), reqOpts).then(throwOrJson);
    } catch (e) {
        optLog(opts, util.format('Error attempting POST. URL:', url, 'Opts:', opts, 'Body:', body, 'Error:', e));
        throw e;
    }
}

/**
 * @function getClientCredentialToken
 * returns the access token for the azure log analytics logging REST API resource.
 * 
 * @returns {string} Access Token to access the Azure Log Analytics REST API resource.
 */

const getClientCredentialToken = async () => {
    const options = {
        tenantId: Config.TENANT_ID,
        clientId: Config.CLIENT_ID,
        redirectURI: Config.REDIRECT_URI,
        resource: Config.RESOURCE,
        clientSecret: Config.CLIENT_SECRET,
        endpoint: Config.AUTH_TOKEN_ENDPOINT,
        grantType: 'client_credentials'
    }
    const headers = { 'content-type': 'application/x-www-form-urlencoded' }
    const body = `grant_type=${options.grantType}&client_id=${options.clientId}&redirect_uri=${options.redirectURI}&resource=${options.resource}&client_secret=${options.clientSecret}`;

    const result = await post(buildUrl(options.tenantId, 'oauth2', 'token'), headers, body, { endpoint: options.endpoint, log });

    return result && result.access_token ? result.access_token : null;
}

/**
 * @function getJWSSignature
 * returns the JWS signature for a given transferId.
 * 
 * @param {string} transferId Id of the transfer.

 * @returns {string}          JWS Signature.    .
 */

const getTransferMessageWithJWSSignature = async (transferId) => {

    const options = {
        workspaceId: Config.WORKSPACE_ID,
        endpoint: Config.LOG_API_ENDPOINT
    }

    const token = await getClientCredentialToken();

    const headers = {
        'content-type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
    const query = getSearchQuery(transferId); // `search '${transferId}' | where LogEntry matches regex '.*Producer.sendMessage::messageProtocol:.*' | where LogEntry matches regex '.*fspiop-signature.*' | take 1 | project LogEntry`;
    const body = { query };

    const result = await post(buildUrl('workspaces', options.workspaceId, 'query'), headers, body, { endpoint: options.endpoint, log });
    const tables = result && result.tables;
    const rows = tables && tables[0].rows;
    let data = rows && rows[0] && rows[0][0];
    if (!data) {
        return null;
    }

    const messagePattern = new RegExp(Config.KAFKA_MESSAGE_PATTERN); // /Producer.sendMessage::messageProtocol:'({.*?})'/;
    const match = data.match(messagePattern);
    let cleanMessage = match[1];

    Config.CLEAN_MESSAGE_REPLACE_PATTERNS.forEach(item => {
        let re = new RegExp(item.PATTERN, item.ATTRIBUTES);
        cleanMessage = cleanMessage.replace(re, item.REPLACE);
    });
    // let message1 = message.replace(/\\n/g, '').replace(/^\'/, '').replace(/\'$/, '').replace(/\\"/g, '"').replace(/\\\\"/g, '\\"');
    // let message1 = message.replace(/\\"/g, '"').replace(/\\\\"/g, '\\"');

    const jsonData = JSON.parse(cleanMessage);
    if (jsonData && jsonData.content && jsonData.content.headers && jsonData.content.headers['fspiop-signature']) {

        let signatureHeader = jsonData.content.headers['fspiop-signature'];
        Config.CLEAN_SIGNATURE_REPLACE_PATTERNS.forEach(item => {
            let re = new RegExp(item.PATTERN, item.ATTRIBUTES);
            signatureHeader = signatureHeader.replace(re, item.REPLACE);
        });

        const validMessage = {
            signatureHeader: JSON.parse(signatureHeader),
            message: jsonData
        }
        return validMessage;
    } else {
        return null;
    }
}

const getSearchQuery = (transferId) => {
    try {
        return Mustache.render(Config.SEARCH_QUERY_TEMPLATE.TEMPLATE, { transferId })
    } catch (e) {
        Logger.error(e)
        throw e
    }
}

module.exports = {
    getTransferMessageWithJWSSignature
};
