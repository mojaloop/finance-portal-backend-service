const casaLib = require('@mojaloop/finance-portal-lib');
const request = require('supertest');
const mockData = require('./mock-data');
const support = require('./_support.js');

let server;
let db;

beforeEach(async () => {
    db = support.createDb();
    server = support.createServer(db);
});

afterEach(async () => {
    server.close();
});

describe('GET /forex/rates', () => {
    casaLib.admin.api.getFxpRatesPerCurrencyChannel = jest.fn();

    afterEach(() => {
        casaLib.admin.api.getFxpRatesPerCurrencyChannel.mockClear();
    });

    describe('Failures:', () => {
        test('should return 502 in case `getFxpRatesPerCurrencyChannel` fails.', async () => {
            casaLib.admin.api.getFxpRatesPerCurrencyChannel
                .mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server).get('/forex/rates');
            expect(response.status).toEqual(502);
            expect(response.body).toEqual({ msg: 'FXP API Error' });
        });
    });
    describe('Success:', () => {
        test('should respond with a valid object propagated from `getFxpRatesPerCurrencyChannel`.', async () => {
            casaLib.admin.api.getFxpRatesPerCurrencyChannel
                .mockImplementation(jest.fn(() => Promise.resolve(mockData.fxpRates)));

            const response = await request(server).get('/forex/rates');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual(mockData.fxpRates);
        });
    });
});

describe('POST /forex/rates/:currencyPair', () => {
    casaLib.admin.api.createFxpRateForCurrencyChannel = jest.fn();

    afterEach(() => {
        casaLib.admin.api.createFxpRateForCurrencyChannel.mockClear();
    });

    describe('Failures:', () => {
        test('should return 502 in case `getFxpRatesPerCurrencyChannel` fails.', async () => {
            casaLib.admin.api.createFxpRateForCurrencyChannel
                .mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server).get('/forex/rates/:currencyPair');
            expect(response.status).toEqual(502);
            expect(response.body).toEqual({ msg: 'FXP API Error' });
        });
    });
    describe('Success:', () => {
        test('should respond with a valid object propagated from `getFxpRatesPerCurrencyChannel`.', async () => {
            casaLib.admin.api.createFxpRateForCurrencyChannel
                .mockImplementation(jest.fn(() => Promise.resolve()));

            const response = await request(server).get('/forex/rates/:currencyPair');
            expect(response.status).toEqual(202);
            expect(response.body).toEqual();
        });
    });
});
