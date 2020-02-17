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
        312: process.env.HUB_REPORT_URL_312,
        644: process.env.HUB_REPORT_URL_644,
    },
    featureFlags: {
        transferVerification: process.env.FEATURE_FLAG_TRANSFER_VERIFICATION.toLowerCase() !== 'false',
    },
};

module.exports = config;
