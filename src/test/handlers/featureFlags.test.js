const request = require('supertest');
const globalConfig = require('../../config/config.js');
const support = require('./_support.js');

describe('GET /featureflags', () => {
    test('should return 200 and false for transferVerification when config is set to "false"', async () => {
        const config = JSON.parse(JSON.stringify(globalConfig));
        config.featureFlags.transferVerification = false;

        const db = support.createDb();
        const server = support.createServer({ db, config });

        const response = await request(server).get('/featureflags');
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({
            transferVerification: false,
        });

        server.close();
    });

    test('should return 200 and true for transferVerification when config is set to "true"', async () => {
        const config = JSON.parse(JSON.stringify(globalConfig));
        config.featureFlags.transferVerification = true;

        const db = support.createDb();
        const server = support.createServer({ db, config });

        const response = await request(server).get('/featureflags');
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({
            transferVerification: true,
        });

        server.close();
    });

    test('should return 200 and values for any additional feature flags when set in config"', async () => {
        const config = JSON.parse(JSON.stringify(globalConfig));
        config.featureFlags.transferVerification = true;
        config.featureFlags.someFlag = true;
        config.featureFlags.someOtherFlag = false;

        const db = support.createDb();
        const server = support.createServer({ db, config });

        const response = await request(server).get('/featureflags');
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({
            transferVerification: true,
            someFlag: true,
            someOtherFlag: false,
        });

        server.close();
    });
});
