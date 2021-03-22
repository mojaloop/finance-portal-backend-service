const request = require('supertest');
const axios = require('axios');
const mockData = require('./mock-data');
const support = require('./_support');

let server;
let db;

beforeEach(async () => {
    jest.setTimeout(7000);
    db = support.createDb();
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('PUT /settlement-window-close/:settlementWindowId', () => {
    test('should close the settle window and return the list of all the settlement windows', async () => {
        axios.post = jest.fn().mockImplementationOnce(() => Promise.resolve({
            status: 200, statusText: 'OK', ok: true,
        }));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`);
        expect(response.status).toEqual(200);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });

    test('should return status code 502 if fails to close the window because the settlement endpoint responds non 202 status', async () => {
        axios.post = jest.fn().mockImplementationOnce(() => Promise.resolve({
            status: 403, statusText: 'FORBIDDEN', ok: false,
        }));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[2].body);
        expect(response.status).toEqual(502);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });

    test('should return status code 502 if fails to close the window', async () => {
        axios.post = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('Error')));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[2].body);
        expect(response.status).toEqual(502);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });
});
