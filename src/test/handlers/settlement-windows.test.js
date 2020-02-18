const request = require('supertest');
const mockData = require('./mock-data');
const support = require('./_support');

let server;
let db;

beforeEach(async () => {
    db = support.createDb();
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('GET /settlement-windows', () => {
    test('should return the list of all the settlement windows', async () => {
        const response = await request(server)
            .get('/settlement-windows?fromDateTime=\'2019-07-29\'&toDateTime=\'2019-07-30\'');
        expect(response.status).toEqual(200);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });
});
