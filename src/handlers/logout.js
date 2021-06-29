const fetch = require('node-fetch');
const https = require('https');
const qs = require('querystring');

// Create an https agent for use with self-signed certificates
// TODO: do we need this? It's used when contacting wso2. Does wso2 have a self-signed cert?
const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

const handler = (router, routesContext) => {
    router.put('/logout', async (ctx, next) => {
        const accessToken = ctx.request.get('Cookie').split('=').splice(1).join('');
        ctx.log.info(`revoking token - ${accessToken}- onlogout`);
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: qs.stringify({
                client_id: routesContext.config.auth.key,
                client_secret: routesContext.config.auth.secret,
                token: accessToken,
            }),
            agent: selfSignedAgent,
        };
        await fetch(routesContext.config.auth.revokeEndpoint, opts);
        ctx.response.set({
            'Set-Cookie': `${routesContext.constants.TOKEN_COOKIE_NAME}=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT;HttpOnly; SameSite=strict${routesContext.config.insecureCookie ? '' : '; Secure'}`,
        });
        ctx.response.body = {
            status: 'Ok',
        };
        ctx.response.status = 200;

        await next();
    });
};

module.exports = handler;
