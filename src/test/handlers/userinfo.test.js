const request = require('supertest');
const support = require('./_support.js');
const { jwtToken } = require('./mock-data');

jest.mock('node-fetch', () => () => require('./_support').mockAuthResponse);
jest.mock('../../lib/permissions', () => ({ permit: jest.fn(() => true) }));

let server;
let db;

beforeEach(async () => {
    db = support.createDb();
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('GET /userinfo', () => {
    test('should respond with username', async () => {
        const response = await request(server)
            .get('/userinfo')
            .set({ Cookie: `mojaloop-portal-token=${jwtToken}` });
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({ username: 'portaladmin' });
    });
});
