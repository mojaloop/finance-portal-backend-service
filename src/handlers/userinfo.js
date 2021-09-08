const { getTokenCookieFromRequest, buildUserInfoResponse } = require('../lib/handlerHelpers');

const handler = (router) => {
    router.get('/userinfo', async (ctx, next) => {
        // Our request has already passed token validation
        const tokenEnc = getTokenCookieFromRequest(ctx);

        ctx.response.body = buildUserInfoResponse(tokenEnc);
        ctx.response.status = 200;

        await next();
    });
};

module.exports = handler;
