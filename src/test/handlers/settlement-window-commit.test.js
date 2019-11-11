const request = require('supertest');
const mockData = require('./mock-data');
const support = require('./_support.js');

const { Database } = support;

jest.genMockFromModule('node-fetch');
jest.mock('node-fetch', () => jest.fn().mockImplementation(() => Promise.resolve({
    status: 200, statusText: 'OK', ok: true,
})));

let server;
let db;
const logger = () => {};

beforeEach(async () => {
    Database.getPaymentMatrixForUpdate = jest.fn()
        .mockImplementation((conn, settlementId) => {
            if (settlementId === '1') {
                return Promise.resolve('[["XOF","1",-25],["XOF","2",-15],["XOF","2",15],["XOF","1","25"]]');
            }
            if (settlementId === '2') {
                return Promise.resolve('[["XOF","1",-25],["XOF","1",-15],["XOF","2","15"],["XOF","3","-15"]]');
            }
            if (settlementId === '3') {
                return Promise.resolve('[["XOF","1",-25],["XOF","1",-15],["XOF","2","15"],["XOF","3","-15"]]');
            }
            if (settlementId === '4') {
                return Promise.resolve('[["XOF","1",-25],["XOF","1",-15],["XOF","2","15"],["XOF","3","-15"]]');
            }
            return null;
        });
    Database.updatePaymentMatrixState = jest.fn();

    db = support.createDb();
    server = support.createServer(db, logger, Database);
});

afterEach(async () => {
    server.close();
});

jest.mock('@mojaloop/finance-portal-lib', () => ({
    admin: {
        api: {
            getParticipantAccounts: jest.fn()
                .mockImplementation(() => Promise.resolve(
                    [
                        ...mockData.positionAccounts,
                        ...mockData.settleSettlementWindow.settlementAccounts,
                    ],
                )),
            getParticipants: jest.fn()
                .mockImplementation(() => Promise.resolve(
                    [
                        ...mockData.dfsps,
                    ],
                )),
            participantFundsOutPrepareReserve: jest.fn()
                .mockImplementation((endpoint, participantName) => {
                    if (participantName === 'testfsp3' || participantName === 'testfsp4') {
                        throw new Error('This fsp should fail');
                    }
                    return true;
                }),
            participantFundsInReserve: jest.fn()
                .mockImplementation((endpoint, participantName) => {
                    if (participantName === 'testfsp4') {
                        throw new Error('This fsp should fail');
                    }
                    return true;
                }),
        },
    },
    settlement: {
        api: jest.fn(() => ({ // this is required because its a constructor
            putSettlement: jest.fn().mockImplementation(() => ({
            })),
        })),
    },
    requests: {
        HTTPResponseError: jest.fn().mockImplementation(() => ({
        })),
    },
}));

describe('PUT /settlement-window-commit/:settlementWindowId', () => {
    test('should do funds in/out and settle window and return the settlement window with SETTLED status', async () => {
        const response = await request(server)
            .put(`/settlement-window-commit/${mockData.settleSettlementWindow.request[0].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[0].body);
        expect(response.status).toEqual(200);
        const expectedWindow = mockData.settlementWindowList
            .find(a => a.settlementWindowId.toString()
                === mockData.settleSettlementWindow.request[0].settlementWindowId);
        expect(response.body).toEqual(expectedWindow);
    });

    test('should settle window and return the settlement window with SETTLED status, when there are no funds in/out pending', async () => {
        const response = await request(server)
            .put(`/settlement-window-commit/${mockData.settleSettlementWindow.request[0].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[0].body);
        expect(response.status).toEqual(200);
        const expectedWindow = mockData.settlementWindowList
            .find(a => a.settlementWindowId.toString()
                === mockData.settleSettlementWindow.request[0].settlementWindowId);
        expect(response.body).toEqual(expectedWindow);
    });

    test('should return status code 500 if one of the funds out fails', async () => {
        const response = await request(server)
            .put(`/settlement-window-commit/${mockData.settleSettlementWindow.request[3].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[3].body);
        const expectedBody = {};
        expect(response.status).toEqual(500);
        expect(response.body).toEqual(expectedBody);
    });

    test('should return status code 500 if a row lock is encountered', async () => {
        Database.getPaymentMatrixForUpdate = jest.fn()
            .mockImplementation(() => { throw { code: 'ER_LOCK_WAIT_TIMEOUT' }; }); // eslint-disable-line no-throw-literal
        server = support.createServer(db, logger, Database);
        const { body } = mockData.settleSettlementWindow.request[3];
        const response = await request(server)
            .put(`/settlement-window-commit/${body.settlementWindowId}`)
            .send(body);
        expect(Database.getPaymentMatrixForUpdate.mock.calls[0][1]).toEqual(body.settlementId);
        expect(Database.getPaymentMatrixForUpdate.mock.calls.length).toEqual(1);
        expect(response.status).toEqual(500);
        expect(response.body).toEqual({});
    });

    test('should return status code 500 and only save failed transactions to the db if one fails', async () => {
        const response = await request(server)
            .put(`/settlement-window-commit/${mockData.settleSettlementWindow.request[3].settlementWindowId}`)
            .send(mockData.settleSettlementWindow.request[3].body);
        const expectedBody = {};
        const expectedArgs = JSON.stringify([['XOF', '3', '-15']]);
        expect(Database.updatePaymentMatrixState.mock.calls.length).toBe(1);
        expect(Database.updatePaymentMatrixState.mock.calls[0][2]).toEqual(expectedArgs);
        expect(response.status).toEqual(500);
        expect(response.body).toEqual(expectedBody);
    });
});
