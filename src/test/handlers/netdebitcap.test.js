const request = require('supertest');
const mockData = require('./mock-data');
const support = require('./_support.js');

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
        const response = await request(server)
            .get(`/netdebitcap/${mockData.participant}`)
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(200);
        expect(response.body).toEqual(expectedNDC);
    });

    test('should return 500 on error', async () => {
        const response = await request(server)
            .get('/netdebitcap/fakeParticipant')
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(500);
    });
});
