const request = require('supertest');
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

jest.genMockFromModule('node-fetch');
jest.mock('node-fetch', () => jest.fn().mockImplementation(() => Promise.resolve({
    staus: 200, statusText: 'OK', ok: true,
})));

const expectedNDC = [{
    currency: 'XOF',
    isActive: 1,
    ledgerAccountType: 'POSITION',
    netDebitCap: 10000,
}];

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
            getNDC: jest.fn().mockImplementationOnce(() => Promise.resolve(mockData.limits.XOF))
                .mockImplementationOnce(() => { throw new Error(); }), // second time throw error
        },
    },
    settlement: {
        api: jest.fn().mockImplementation(() => ({
        })),
    },
    requests: {
        HTTPResponseError: jest.fn().mockImplementation(() => ({
        })),
    },
}));

describe('GET /netdebitcap/:participantName', () => {
    test('should respond with only active accounts', async () => {
        const response = await request(server).get(`/netdebitcap/${mockData.participant}`);
        expect(response.status).toEqual(200);
        expect(response.body).toEqual(expectedNDC);
    });

    test('should return 500 on error', async () => {
        const response = await request(server).get('/netdebitcap/fakeParticipant');
        expect(response.status).toEqual(500);
    });
});
