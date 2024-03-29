const request = require('supertest');
const axios = require('axios');
const mockData = require('./mock-data');
const support = require('./_support');
const config = require('../../config/config');

jest.mock('node-fetch', () => () => require('./_support').mockAuthResponse);
jest.mock('../../lib/permissions', () => ({ permit: jest.fn(() => true) }));

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
    test('should close the settle window and return the list of all the settlement windows when external settlement endpoint is defined', async () => {
        config.externalSettlementsEndpoint = 'http://external/settlement';
        axios.post = jest.fn().mockImplementationOnce(() => Promise.resolve({
            status: 202, statusText: 'OK', ok: true,
        }));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(200);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });

    test('should close the settle window and return the list of all the settlement windows', async () => {
        config.externalSettlementsEndpoint = null;
        axios.post = jest.fn().mockImplementationOnce(() => Promise.resolve({
            status: 200, statusText: 'OK', ok: true,
        }));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(200);
        const expectedWindowList = mockData.settlementWindowList;
        expect(response.body).toEqual(expectedWindowList);
    });

    test('should return status code 502 and error information if fails to close the window because the settlement endpoint responds non 202 status', async () => {
        config.externalSettlementsEndpoint = null;
        const data = { errorInformation: 'error information' };
        axios.post = jest.fn().mockImplementationOnce(() => Promise.resolve({
            status: 403, statusText: 'FORBIDDEN', ok: false, data,
        }));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[2].body)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(403);
        expect(response.body).toEqual(data);
    });

    test('should return status code 500 if fails to close the window', async () => {
        config.externalSettlementsEndpoint = null;
        axios.post = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('Error')));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[2].body)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(500);
    });

    test('should return status code 500 if fails to close the window using external settlement service', async () => {
        config.externalSettlementsEndpoint = 'http://external/settlement';
        axios.post = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('Error')));
        const response = await request(server)
            .put(`/settlement-window-close/${mockData.settleSettlementWindow.request[2].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[2].body)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(500);
    });
});
