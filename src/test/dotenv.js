const dotenv = require('dotenv');

function dotenvSetup() {
    dotenv.config({ path: './test/.test_env' });
}

module.exports = dotenvSetup;
