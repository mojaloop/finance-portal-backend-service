const { getTokenCookieFromRequest } = require('../../../lib/handlerHelpers');
const chance = new (require('chance'))();

const jwtPool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.';

describe('getTokenCookieFromRequest', () => {
    it('should extract the token from a simple cookie with the "correct" name', () => {
        const TOKEN_COOKIE_NAME = 'mojaloop-portal-token';
        // Will look something like a JWT token
        const mockToken = chance.string({
            length: 200,
            pool: jwtPool,
        });
        const mockCtx = {
            request: {
                get: () => `${TOKEN_COOKIE_NAME}=${mockToken}`,
            },
            constants: {
                TOKEN_COOKIE_NAME,
            },
        };
        const token = getTokenCookieFromRequest(mockCtx);
        expect(token).toEqual(mockToken);
    });

    it('should extract the token from a simple cookie with a random name', () => {
        const TOKEN_COOKIE_NAME = chance.string();
        // Will look something like a JWT token
        const mockToken = chance.string({
            length: 200,
            pool: jwtPool,
        });
        const mockCtx = {
            request: {
                get: () => `${TOKEN_COOKIE_NAME}=${mockToken}`,
            },
            constants: {
                TOKEN_COOKIE_NAME,
            },
        };
        const token = getTokenCookieFromRequest(mockCtx);
        expect(token).toEqual(mockToken);
    });

    it('should extract the token from a complex cookie', () => {
        const numCookies = Math.floor(Math.random() * 20);
        const cookieKvPairs = Array
            .from({ length: numCookies })
            .map(() => [chance.string(), chance.string()]);
        const cookieString = cookieKvPairs.map(([k, v]) => `${k}=${v}`).join(';');
        const [TOKEN_COOKIE_NAME, mockToken] = cookieKvPairs[
            Math.floor(Math.random() * numCookies)
        ];
        const mockCtx = {
            request: {
                get: () => cookieString,
            },
            constants: {
                TOKEN_COOKIE_NAME,
            },
        };
        const token = getTokenCookieFromRequest(mockCtx);
        expect(token).toEqual(mockToken);
    });
});
