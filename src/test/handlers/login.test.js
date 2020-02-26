// Disable camelcase for use of access_token, as propagated from wso2
/* eslint-disable camelcase */
const request = require('supertest');
const fetch = require('node-fetch');

const support = require('./_support');
const globalConfig = require('../../config/config');

const { Response } = jest.requireActual('node-fetch');

jest.mock('node-fetch');

describe('POST /login', () => {
    test('should respond with insecure directives when cookie is set to insecure', async () => {
        const config = { ...globalConfig, insecureCookie: true, auth: { bypass: false } };
        const server = support.createServer({ db: support.createDb(), config });
        const access_token = 'whatever';
        fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ access_token }))));
        const response = await request(server).post('/login');
        expect(response.status).toEqual(200);
        expect(response.headers['set-cookie']).toEqual([`token=${access_token};`]);
    });

    test('should respond with secure directives when cookie is not set to insecure', async () => {
        const config = { ...globalConfig, insecureCookie: false, auth: { bypass: false } };
        const server = support.createServer({ db: support.createDb(), config });
        const access_token = 'whatever';
        fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ access_token }))));
        const response = await request(server).post('/login');
        expect(response.status).toEqual(200);
        expect(response.headers['set-cookie']).toEqual([
            `token=${access_token}; HttpOnly; SameSite=strict; Secure`,
        ]);
    });
});
