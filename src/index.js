const pino = require('pino');
const createServer = require('./server');
const Database = require('./db');
const config = require('./config/config');
const { version } = require('./package.json');

// /////////////////////////////////////////////////////////////////////////////
// Config
// /////////////////////////////////////////////////////////////////////////////

const logger = pino({
    serializers: {
        // return the body for any HTTPResponseError types we receive from finance-portal-lib
        err: pino.stdSerializers.wrapErrorSerializer((e) => {
            if (e.type !== 'HTTPResponseError') {
                return e;
            }
            return {
                ...e,
                body: e.raw.getData().resp,
                request: e.raw.getData().request,
                stack_arr: e.stack.split('\n').map((line) => line.trim()),
            };
        }),
    },
});

// Log development/production status
logger.child({ version, env: process.env.NODE_ENV }).info('Running portal backend service');

// Set up the db
const db = new Database(config.db);

// Warnings for certain environment var settings
if (config.cors.reflectOrigin && process.env.NODE_ENV !== 'development') {
    logger.warn('WARNING: NODE_ENV != \'development\' and CORS origin being reflected in Access-Control-Allow-Origin header. '
        + 'Changing CORS_ACCESS_CONTROL_REFLECT_ORIGIN to false is important for preventing CSRF.');
}

// /////////////////////////////////////////////////////////////////////////////
// Start app
// /////////////////////////////////////////////////////////////////////////////

logger.child({ config }).info('Config:');
const server = createServer(config, db, logger, Database);
const listener = server.listen(config.server.listenPort);

const handle = async (signal) => {
    logger.info(`Received signal ${signal}. Shutting down..`);
    listener.close();
    process.exit();
};
process.on('SIGINT', handle);
process.on('SIGTERM', handle);

logger.info(`Listening on port ${config.server.listenPort}`);
