const request = require('supertest');
const support = require('./_support');

const server = support.createServer(support.createDb());

describe('GET /', () => {
    test('should respond as expected', async () => {
        const response = await request(server).get('/');
        expect(response.status).toEqual(204);
    });
});
