const glob = require('glob');
const Koa = require('koa');
const koaBody = require('koa-body');
const fetch = require('node-fetch');
const https = require('https');
const Router = require('koa-router');
const { randomPhrase } = require('@mojaloop/sdk-standard-components');
const { permit } = require('./lib/permissions');
const { getTokenCookieFromRequest } = require('./lib/handlerHelpers');

// TODO:
// - reject content types that are not application/json (this comes back to validation)

// Create an https agent for use with self-signed certificates
// TODO: do we need this? It's used when contacting wso2. Does wso2 have a self-signed cert?
const selfSignedAgent = new https.Agent({ rejectUnauthorized: false });

//
// Server
//
const createServer = (config, db, log, Database) => {
    const app = new Koa();

    app.context.constants = {
        TOKEN_COOKIE_NAME: 'mojaloop-portal-token',
    };

    //
    // Pre-route-handler middleware
    //

    // Log all requests
    app.use(async (ctx, next) => {
        ctx.log = log.child({
            id: randomPhrase(),
            request: ctx.request,
        });
        ctx.log.info('request received');
        await next();
        ctx.log.child({
            response: ctx.response,
        }).info('handled request');
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
            ctx.log.child({ err }).error('Unhandled error');
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
                ctx.log.child({ err }).error('Database dummy query failed');
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
            ctx.log.info('login request received - user will authenticate with login credentials - token validation not performed');
            await next();
            return;
        }

        const token = getTokenCookieFromRequest(ctx);

        if (!token) {
            ctx.response.status = 401;
            ctx.response.body = { message: 'Authorization token cookie not present' };
            return;
        }

        ctx.log.info('validating request token:', token);
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
            ctx.log.info(`authorization server returned [${authResponse.status}]: ${message}`);
            ctx.response.status = 401;
            ctx.response.body = { message: message || 'Unauthorized' };
            return;
        }
        ctx.log.info(`authorization server returned [${authResponse.status}] response`);
        ctx.log.info('token validated by authorization server');

        const authResponseToken = await authResponse.json();
        const isValid = authResponseToken.active === true;

        if (!isValid) {
            ctx.log.info('session expired');
            ctx.response.status = 401; // TODO: 403?
            ctx.response.body = { message: 'Session expired' };
            return;
        }

        const isPermitted = await permit(
            config.auth.userInfoEndpoint, token, ctx.request.method, ctx.request.path, ctx.log,
        );
        if (!isPermitted) {
            ctx.log.info('request forbidden according to application permissions');
            ctx.response.body = { message: 'Forbidden' };
            ctx.response.status = 401;
            return;
        }
        ctx.log.info('request permitted according to application permissions');

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
                Database,
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
