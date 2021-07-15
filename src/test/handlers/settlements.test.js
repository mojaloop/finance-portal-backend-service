const portalLib = require('@mojaloop/finance-portal-lib');
const request = require('supertest');
const support = require('./_support');

jest.mock('node-fetch', () => () => require('./_support').mockAuthResponse);
jest.mock('../../lib/permissions', () => ({ permit: jest.fn(() => true) }));

let server;
let db;
let mockSettlements;

beforeEach(async () => {
    portalLib.settlement.api = jest.fn(() => ({
        getSettlements: () => mockSettlements,
    }));
    mockSettlements = [];
    server = support.createServer({ db });
});

afterEach(async () => {
    server.close();
});

describe('GET /settlements', () => {
    test('should return the list of settlements', async () => {
        const response = await request(server)
            .get('/settlements?fromDateTime=\'2019-07-29\'&toDateTime=\'2019-07-30\'')
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(200);
        const expectedList = mockSettlements;
        expect(response.body).toEqual(expectedList);
    });

    test('should return an empty list of settlements when central settlement indicates via HTTP 400 response that there are none', async () => {
        // the offending code is here: https://github.com/mojaloop/central-settlement/blob/45ecfe32d1039870aa9572e23747c24cd6d53c86/src/domain/settlement/index.js#L215
        // this returns an HTTP 400 response in the case that there are no settlements. The portal
        // backend sanitises this response to an empty list.
        portalLib.settlement.api = jest.fn(() => ({
            getSettlements: () => {
                throw new portalLib.HTTPResponseError({
                    res: {
                        status: 400,
                    },
                    resp: {
                        errorInformation: {
                            errorCode: '3100',
                            errorDescription: 'Generic validation error - Settlements not found',
                        },
                    },
                });
            },
        }));
        const response = await request(server)
            .get('/settlements?fromDateTime=\'2019-07-29\'&toDateTime=\'2019-07-30\'')
            .set(support.mockTokenHeader);
        expect(response.status).toEqual(200);
        const expectedList = mockSettlements;
        expect(response.body).toEqual(expectedList);
    });
});
