const glob = require('glob');
const Koa = require('koa');
const koaBody = require('koa-body');
const fetch = require('node-fetch');
const https = require('https');
const util = require('util');
const Router = require('koa-router');
const { permit } = require('./lib/permissions');

// TODO:
// - reject content types that are not application/json (this comes back to validation)

// Create an https agent for use with self-signed certificates
// TODO: do we need this? It's used when contacting wso2. Does wso2 have a self-signed cert?
const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

const constants = {
    TOKEN_COOKIE_NAME: 'mojaloop-portal-token',
};

//
// Server
//
const createServer = (config, db, log, Database) => {
    const app = new Koa();

    //
    // Pre-route-handler middleware
    //

    // Log all requests
    app.use(async (ctx, next) => {
        log(`Received: ${ctx.request.method} ${ctx.request.path}${ctx.request.search}`);
        await next();
        const pretty = obj => JSON.stringify(obj, null, 2);
        const msg = (
            'Handled request:\n'
              + `${ctx.request.method} ${ctx.request.path}${ctx.request.search}\n`
              + `${pretty(ctx.request.headers)}\n`
              + `${pretty(ctx.request.body)}\n`
              + `Response: HTTP ${ctx.response.status}\n`
              + `${pretty(ctx.response.headers)}\n`
              + `${pretty(ctx.response.body)}`
        ).replace(/\n/g, '\n  ');
        log(msg);
    });

    // Allow any origin by echoing the origin back to the client
    // TODO: we should remove this in production and use k8s to route the responses such that the
    // root serves the UI and all non-root requests serve the API.
    if (config.cors.reflectOrigin) {
        app.use(async (ctx, next) => {
            await next();
            if (undefined !== ctx.request.headers.origin) {
                ctx.response.set({
                    'Access-Control-Allow-Origin': ctx.request.headers.origin,
                    'Access-Control-Allow-Credentials': true,
                });
            }
        });
    }

    // Return 500 for any unhandled errors
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            log('Unhandled error', util.inspect(err, { depth: 10 }));
            ctx.response.status = 500;
            ctx.response.body = { msg: 'Unhandled Internal Error' };
        }
    });

    // Health-check
    app.use(async (ctx, next) => {
        if (ctx.request.path === '/') {
            try {
                await db.dummyQuery();
                ctx.response.status = 204;
            } catch (err) {
                ctx.response.status = 500;
            }
            return;
        }
        await next();
    });

    // Nasty CORS response, should really be per-route
    // TODO: tidy/fix
    app.use(async (ctx, next) => {
        if (ctx.request.method === 'OPTIONS') {
            ctx.response.set({
                'Access-Control-Allow-Credentials': config.cors.reflectOrigin,
                'Access-Control-Allow-Methods': 'GET,PUT,POST',
                'Access-Control-Allow-Headers': 'content-type,accept,cookie',
            });
            if (config.cors.reflectOrigin) {
                ctx.response.set({
                    'Access-Control-Allow-Origin': ctx.request.headers.origin,
                    'Access-Control-Allow-Credentials': true,
                });
            }
            ctx.response.status = 200;
        } else {
            await next();
        }
    });

    // Authorise all requests except login
    // TODO: authorise before handling CORS?
    app.use(async (ctx, next) => {
        if (ctx.request.path.split('/').pop() === 'login' && ctx.request.method.toLowerCase() === 'post') {
            log('login request received - user will authenticate with login credentials - token validation not performed');
            await next();
            return;
        }
        if (config.auth.bypass) {
            log('request token validation bypassed as per config');
            await next();
            return;
        }

        // The cookie _should_ look like:
        //   mojaloop-portal-token=abcde
        // But when doing local development, the cookie may look like:
        //   some-rubbish=whatever; mojaloop-portal-token=abcde; other-rubbish=defgh
        // because of other cookies set on the host. So we take some more care extracting it here.
        const token = ctx.request
            // get the cookie header string, it'll look like
            // some-rubbish=whatever; token=abcde; other-crap=defgh
            .get('Cookie')
            // Split it so we have some key-value pairs that look like
            // [['some-rubbish', 'whatever'], ['token', 'abcde'], ['other-rubbish', 'defgh']]
            .split(';')
            .map(cookie => cookie.trim().split('='))
            // Find the token cookie and get its value
            // We assume there's only one instance of our cookie
            .find(([name]) => name === constants.TOKEN_COOKIE_NAME)[1];

        if (!token) {
            ctx.response.status = 401;
            ctx.response.body = { message: 'Authorization token cookie not present' };
            return;
        }

        log('validating request token:', token);
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `token=${token}`,
            agent: selfSignedAgent,
        };

        const authResponse = await fetch(config.auth.validateEndpoint, opts);
        if (authResponse.status !== 200) {
            const message = await authResponse.text();
            log(`authorization server returned [${authResponse.status}]: ${message}`);
            ctx.response.status = 401;
            ctx.response.body = { message: message || 'Unauthorized' };
            return;
        }
        log(`authorization server returned [${authResponse.status}] response`);
        log('token validated by authorization server');

        const authResponseToken = await authResponse.json();
        const isValid = authResponseToken.active === true;

        if (!isValid) {
            log('session expired');
            ctx.response.status = 401; // TODO: 403?
            ctx.response.body = { message: 'Session expired' };
            return;
        }

        const isPermitted = await permit(
            config.auth.userInfoEndpoint, token, ctx.request.method, ctx.request.path, log,
        );
        // user role/permissions
        if (!isPermitted) {
            log('request forbidden according to application permissions');
            ctx.response.body = { message: 'Forbidden' };
            ctx.response.status = 401;
            return;
        }
        log('request permitted according to application permissions');

        await next();
    });

    // Parse request bodies of certain content types (see koa-body docs for more)
    app.use(koaBody());

    //
    // Route handling
    //
    const mountRoutes = () => {
        const router = new Router();
        const files = glob.sync('./handlers/*.js');

        files.forEach((file) => {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            const route = require(file);

            route(...[router, {
                config,
                db,
                log,
                Database,
                constants,
            }]);
        });

        // Route requests according to the routes above
        app.use(router.routes());
        app.use(router.allowedMethods());
    };

    mountRoutes();

    return app;
};

module.exports = createServer;
