const request = require('supertest');
const config = require('../../config/config.js');
const support = require('./_support.js');

describe('GET /featureflags', () => {
    describe('Failures:', () => {
        test('should return 200 and false for transferVerification when config is set to "false"', async () => {
            const confOverride = JSON.parse(JSON.stringify(config));
            confOverride.featureFlags.transferVerification = false;

            const db = support.createDb();
            const server = support.createServer(db, undefined, undefined, confOverride);

            const response = await request(server).get('/featureflags');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                transferVerification: false,
            });

            server.close();
        });

        test('should return 200 and true for transferVerification when config is set to "true"', async () => {
            const confOverride = JSON.parse(JSON.stringify(config));
            confOverride.featureFlags.transferVerification = true;

            const db = support.createDb();
            const server = support.createServer(db, undefined, undefined, confOverride);

            const response = await request(server).get('/featureflags');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                transferVerification: true,
            });

            server.close();
        });

        test('should return 200 and values for any additional feature flags when set in config"', async () => {
            const confOverride = JSON.parse(JSON.stringify(config));
            confOverride.featureFlags.someFlag = true;
            confOverride.featureFlags.someOtherFlag = false;

            const db = support.createDb();
            const server = support.createServer(db, undefined, undefined, confOverride);

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
});
