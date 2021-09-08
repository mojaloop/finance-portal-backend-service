const fetch = require('node-fetch');
const https = require('https');
const qs = require('querystring');
const { buildUserInfoResponse } = require('../lib/handlerHelpers');

// Create an https agent for use with self-signed certificates
// TODO: do we need this? It's used when contacting wso2. Does wso2 have a self-signed cert?
const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

const handler = (router, routesContext) => {
    const cookieDirectives = (cookieName, token, insecure) => (
        insecure
            ? `${cookieName}=${token}; Path=/`
            : `${cookieName}=${token}; HttpOnly; SameSite=strict; Secure; Path=/`
    );

    router.post('/login', async (ctx, next) => {
        const { username, password } = ctx.request.body;
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: qs.stringify({
                client_id: routesContext.config.auth.key,
                client_secret: routesContext.config.auth.secret,
                grant_type: 'password',
                scope: 'openid',
                username,
                password,
            }),
            agent: selfSignedAgent,
        };

        const oauth2Token = await fetch(routesContext.config.auth.loginEndpoint, opts)
            .then((res) => res.json());
        if (oauth2Token.access_token === undefined) {
            ctx.response.status = 401; // TODO: Or 403?
            return;
        }

        ctx.response.body = buildUserInfoResponse(oauth2Token.access_token);
        ctx.response.set({
            'Set-Cookie': cookieDirectives(
                ctx.constants.TOKEN_COOKIE_NAME,
                oauth2Token.access_token,
                routesContext.config.insecureCookie,
            ),
        });
        ctx.response.status = 200;

        await next();
    });
};

module.exports = handler;
