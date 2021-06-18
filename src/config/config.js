const { URL } = require('url');
const path = require('path');

// Load .env file into process.env if it exists. This is convenient for running locally.
require('dotenv').config({
    path: path.resolve(__dirname, '../../.env'),
});

// Create config from environment. The idea of putting this here is that all environment variables
// are places into this config. That way, if necessary, it's easy for a reader to see all of the
// required config in one place.
const config = {
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        port: process.env.DB_PORT,
        password: process.env.DB_PASSWORD,
        database: 'central_ledger',
    },
    server: {
        listenPort: process.env.LISTEN_PORT,
    },
    fxpEndpoint: process.env.FXP_ENDPOINT,
    externalSettlementsEndpoint: process.env.EXTERNAL_SETTLEMENTS_ENDPOINT,
    centralSettlementsEndpoint: process.env.CENTRAL_SETTLEMENTS_ENDPOINT,
    centralLedgerEndpoint: process.env.CENTRAL_LEDGER_ENDPOINT,
    settlementManagementEndpoint: process.env.SETTLEMENT_MANAGEMENT_ENDPOINT,
    auth: {
        bypass: process.env.BYPASS_AUTH === 'true',
        loginEndpoint: (new URL(process.env.AUTH_SERVICE, `${process.env.AUTH_SERVER}:${process.env.AUTH_SERVER_PORT}`)).href,
        userInfoEndpoint: (new URL(process.env.USERINFO_SERVICE, `${process.env.AUTH_SERVER}:${process.env.AUTH_SERVER_PORT}`)).href,
        validateEndpoint: (new URL(process.env.VALIDATE_SERVICE, `${process.env.AUTH_SERVER}:${process.env.AUTH_SERVER_PORT}`)).href,
        revokeEndpoint: (new URL(process.env.REVOKE_SERVICE, `${process.env.AUTH_SERVER}:${process.env.AUTH_SERVER_PORT}`)).href,
        key: process.env.AUTH_SERVER_CLIENTKEY,
        secret: process.env.AUTH_SERVER_CLIENTSECRET,
    },
    insecureCookie: process.env.INSECURE_COOKIE === 'true',
    cors: {
        reflectOrigin: process.env.CORS_ACCESS_CONTROL_REFLECT_ORIGIN === 'true',
    },
    reportUrls: {
        settlement: process.env.SETTLEMENT_REPORT_URL,
    },
    featureFlags: {
        transferVerification: process.env.FEATURE_FLAG_TRANSFER_VERIFICATION === 'true',
    },
    azureLog: {
        authTokenEndpoint: process.env.AZURE_AUTH_TOKEN_ENDPOINT,
        cleanMessageReplacePatterns: [
            {
                pattern: '\\\\"',
                attributes: 'g',
                replace: '"',
            },
            {
                pattern: '\\\\\\\\"',
                attributes: 'g',
                replace: '\\"',
            },
        ],
        cleanSignatureReplacePatterns: [
            {
                pattern: '\\\\\\\\"',
                attributes: 'g',
                replace: '"',
            },
        ],
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        grantType: process.env.AZURE_GRANT_TYPE,
        kafkaMessagePattern: process.env.AZURE_KAFKA_MESSAGE_PATTERN,
        logApiEndpoint: process.env.AZURE_LOG_API_ENDPOINT,
        redirectUri: process.env.AZURE_REDIRECT_URI,
        resource: process.env.AZURE_RESOURCE,
        searchQueryTemplate: {
            regex: process.env.AZURE_SEARCH_QUERY_REGEX,
            template: process.env.AZURE_SEARCH_QUERY_TEMPLATE,
        },
        tenantId: process.env.AZURE_TENANT_ID,
        workspaceId: process.env.AZURE_WORKSPACE_ID,
    },
};

module.exports = config;
