// Simple logging function. Should replace this with structured logging.
const log = (...args) => {
    // eslint-disable-next-line no-console
    console.log(`[${(new Date()).toISOString()}]`, ...args);
};

module.exports = log;
