const jwt = require('jsonwebtoken');
const { getTokenCookieFromRequest } = require('../lib/handlerHelpers');

const handler = (router) => {
    router.get('/userinfo', async (ctx, next) => {
        // Our request has already passed token validation
        const tokenEnc = getTokenCookieFromRequest(ctx);
        const token = jwt.decode(tokenEnc);
        const username = token.sub.split('@')[0];

        ctx.response.body = {
            username,
        };
        ctx.response.status = 200;

        await next();
    });
};

module.exports = handler;
