const fss = require('fast-safe-stringify');

// Simple logging function. Should replace this with structured logging.
const log = (...args) => {
    // eslint-disable-next-line no-console
    console.log(`[${(new Date()).toISOString()}]`, ...args.map(fss));
};

module.exports = log;
