const createServer = require('./server');
const Database = require('./db');
const config = require('./config/config');
const log = require('./lib/log');

// /////////////////////////////////////////////////////////////////////////////
// Config
// /////////////////////////////////////////////////////////////////////////////

// Set up the db
const db = new Database(config.db);

// Log development/production status
log('Running in ', process.env.NODE_ENV);

// Warnings for certain environment var settings
if (config.cors.reflectOrigin && process.env.NODE_ENV !== 'development') {
    log('WARNING: NODE_ENV != \'development\' and CORS origin being reflected in Access-Control-Allow-Origin header. '
        + 'Changing CORS_ACCESS_CONTROL_REFLECT_ORIGIN to false is important for preventing CSRF.');
}
if (config.auth.bypass) {
    log('WARNING: auth bypass enabled- all login requests will be approved');
}


// /////////////////////////////////////////////////////////////////////////////
// Start app
// /////////////////////////////////////////////////////////////////////////////

log('Config:', config);
const server = createServer(config, db, log, Database);
server.listen(config.server.listenPort);
log(`Listening on port ${config.server.listenPort}`);
