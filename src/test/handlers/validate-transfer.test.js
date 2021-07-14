const JWT = require('jsonwebtoken');
const request = require('supertest');
const mockData = require('./mock-data');
const support = require('./_support.js');

const azureLog = require('../../lib/azureLogUtil');

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

describe('GET /validate-transfer/:transferId', () => {
    beforeEach(async () => {
        db.getTransferDetails = jest.fn(() => mockData.transferDetails);
        azureLog.getTransferMessageWithJWSSignature = jest.fn(() => mockData.transferMessage);
        JWT.verify = jest.fn(() => true);
    });

    afterEach(() => {
        db.getTransferDetails.mockClear();
        azureLog.getTransferMessageWithJWSSignature.mockClear();
        JWT.verify.mockClear();
    });

    describe('Failures:', () => {
        test('should return status code 500 in case `db.getTransferDetails` fails.', async () => {
            db
                .getTransferDetails
                .mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server)
                .get(`/validate-transfer/${mockData.transferId}`)
                .set(support.mockTokenHeader);
            expect(response.status).toEqual(500);
            expect(response.body).toEqual({ msg: 'Unhandled Internal Error' });
        });
        test('should return status code 500 in case `getTransferMessageWithJWSSignature` fails.', async () => {
            azureLog
                .getTransferMessageWithJWSSignature
                .mockImplementation(jest.fn(() => { throw new Error('foo'); }));

            const response = await request(server)
                .get(`/validate-transfer/${mockData.transferId}`)
                .set(support.mockTokenHeader);
            expect(response.status).toEqual(500);
            expect(response.body).toEqual({ msg: 'Unhandled Internal Error' });
        });
        describe('In case the JWS message is valid (not empty):', () => {
            test('should return status code 200 in case `JWT.verify` fails.', async () => {
                JWT
                    .verify
                    .mockImplementation(jest.fn(() => { throw new Error('foo'); }));

                const response = await request(server)
                    .get(`/validate-transfer/${mockData.transferId}`)
                    .set(support.mockTokenHeader);
                expect(response.status).toEqual(200);
            });
        });
    });
    describe('Success:', () => {
        test('should return status code 200 and a valid object containing `isValidTransfer: false` '
            + 'if `JWT.verify` does not return `true`.', async () => {
            JWT
                .verify
                .mockImplementation(jest.fn(() => false));

            const response = await request(server)
                    .get(`/validate-transfer/${mockData.transferId}`)
                    .set(support.mockTokenHeader);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                transfer: mockData.transferDetails,
                isValidTransfer: false,
            });
        });

        test('should return status code 200 and a valid object containing `isValidTransfer: false` '
            + 'if `JWT.verify` returns `true`.', async () => {
            JWT
                .verify
                .mockImplementation(jest.fn(() => true));

            const response = await request(server)
                    .get(`/validate-transfer/${mockData.transferId}`)
                    .set(support.mockTokenHeader);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                transfer: mockData.transferDetails,
                isValidTransfer: true,
            });
        });
    });
});
