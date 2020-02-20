const portalLib = require('@mojaloop/finance-portal-lib');
const request = require('supertest');
const config = require('../../config/config');
const handlerHelpers = require('../../lib/handlerHelpers');
const mockData = require('./mock-data');
const support = require('./_support.js');

let server;
let db;

beforeEach(async () => {
    db = support.createDb();
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('PUT /settlement-window-commit/:settlementWindowId', () => {
    portalLib.admin.api.commitSettlementWindow = jest.fn();
    handlerHelpers.getSettlementWindows = jest.fn();

    const targetSettlementWindowId = mockData.settleSettlementWindow.request[3].settlementWindowId;
    const targetBody = mockData.settleSettlementWindow.request[3].body;

    afterEach(() => {
        expect(portalLib.admin.api.commitSettlementWindow.mock.calls[0][0])
            .toEqual(config.externalSettlementsEndpoint);
        expect(portalLib.admin.api.commitSettlementWindow.mock.calls[0][1])
            .toStrictEqual(Number(targetBody.settlementId));

        portalLib.admin.api.commitSettlementWindow.mockClear();
        handlerHelpers.getSettlementWindows.mockClear();
    });

    describe('Failures:', () => {
        test('should return status code 502 in case `commitSettlementWindow` fails', async () => {
            portalLib.admin.api.commitSettlementWindow.mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server)
                .put(`/settlement-window-commit/${targetSettlementWindowId}`)
                .send(targetBody);
            expect(response.status).toEqual(502);
            expect(response.body).toEqual({ msg: 'Settlement API Error' });
        });

        test('should return a successful status code in case `getSettlementWindows` fails', async () => {
            portalLib.admin.api.commitSettlementWindow
                .mockImplementation(jest.fn(() => Promise.resolve()));
            handlerHelpers.getSettlementWindows.mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server)
                .put(`/settlement-window-commit/${targetSettlementWindowId}`)
                .send(targetBody);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({});
        });
    });
    describe('Success:', () => {
        test('should respond with a valid and latest settlement window in case it succeeds.', async () => {
            portalLib.admin.api.commitSettlementWindow
                .mockImplementation(jest.fn(() => Promise.resolve()));
            handlerHelpers
                .getSettlementWindows
                .mockImplementation(
                    jest.fn(() => Promise.resolve(mockData.settlementWindowList)),
                );

            const response = await request(server)
                .put(`/settlement-window-commit/${targetSettlementWindowId}`)
                .send(targetBody);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual(mockData.settlementWindowList[0]);
        });
    });
});
