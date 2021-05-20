const request = require('supertest');
const support = require('../handlers/_support');
const globalConfig = require('../../config/config');

let db;

beforeEach(() => {
    db = support.createDb();
});

describe('server', () => {
    test('should start and stop', () => {
        const server = support.createServer({ db });
        server.listen();
        server.close();
    });

    test('should reflect CORS header when configured to do so', async () => {
        db.getDfsps = () => [];
        const config = { ...globalConfig, cors: { reflectOrigin: true } };
        const server = support.createServer({ db, config });
        const testOrigin = 'test';
        const response = await request(server).get('/dfsps').set('origin', testOrigin);
        expect(response.headers['access-control-allow-origin']).toEqual(testOrigin);
        expect(response.headers['access-control-allow-credentials']).toEqual('true');
    });

    test('should reflect CORS header when an unhandled error is encountered', async () => {
        db.getDfsps = () => { throw new Error('test'); };
        const config = { ...globalConfig, cors: { reflectOrigin: true } };
        const server = support.createServer({ db, config });
        const testOrigin = 'test';
        const response = await request(server).get('/dfsps').set('origin', testOrigin);
        expect(response.headers['access-control-allow-origin']).toEqual(testOrigin);
        expect(response.headers['access-control-allow-credentials']).toEqual('true');
    });

    test('should return 401 for missing cookie header', async () => {
        const config = { ...globalConfig };
        config.auth.bypass = false;
        const server = support.createServer({ db, config });
        const response = await request(server).get('/dfsps').unset('cookie');
        expect(response.statusCode).toBe(401);
    });
});
