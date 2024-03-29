const http = require('http');
const globalConfig = require('../../config/config');
const appCreateServer = require('../../server');
const mockData = require('./mock-data.js');

class Database {
    constructor() {
        this.connect = jest.fn();
        this.dummyQuery = jest.fn();
        this.getDfspsAccounts = jest.fn()
            .mockImplementation(() => Promise.resolve(mockData.dfspsAccounts));
        this.createDfspAccount = jest.fn()
            .mockImplementation(() => Promise.resolve(mockData.dfspsAccount));
        this.getDfsps = jest.fn().mockImplementation(() => Promise.resolve(mockData.dfsps));
        this.getSettlementWindows = jest.fn()
            .mockImplementation(() => Promise.resolve(mockData.settlementWindowList));
        this.connection = {
            getConnection: jest.fn()
                .mockImplementation(() => Promise.resolve({
                    query: jest.fn(),
                    release: jest.fn(),
                })),
        };
    }

    static getPaymentMatrixForUpdate() {}

    static updatePaymentMatrixState() {}
}

const createDb = () => (new Database());

const nullLogger = () => {};
const createLogger = () => ({
    warn: nullLogger,
    info: nullLogger,
    error: nullLogger,
    child: createLogger,
});

const createServer = ({
    db,
    logger = createLogger(),
    database,
    config = globalConfig,
} = {}) => http.createServer(
    appCreateServer(config, db, logger, database).callback(),
);

const mockAuthResponseBody = {
    access_token: 'mock-access-token',
    active: true,
};

const mockAuthResponse = {
    status: 200,
    json: () => mockAuthResponseBody,
};

module.exports = {
    createDb,
    createServer,
    Database,
    mockTokenHeader: { Cookie: 'mojaloop-portal-token=abcde' },
    mockAuthResponseBody,
    mockAuthResponse,
};
