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

//
// Server
//
const createServer = (config, db, log, Database) => {
    const app = new Koa();

    //
    // Pre-route-handler middleware
    //
    // Return 500 for any unhandled errors
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            log('Error', util.inspect(err, { depth: 10 }));
            ctx.response.status = 500;
            ctx.response.body = { msg: 'Unhandled Internal Error' };
        }
        log(`${ctx.request.method} ${ctx.request.path} | ${ctx.response.status}`);
    });

    // Log all requests
    app.use(async (ctx, next) => {
        log(`${ctx.request.method} ${ctx.request.path}${ctx.request.search}`);
        await next();
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
        if (ctx.request.path === '/login' && ctx.request.method.toLowerCase() === 'post') {
            log('bypassing validation on login request');
            await next();
            return;
        }
        if (config.auth.bypass) {
            log('request validation bypassed');
            await next();
            return;
        }

        const token = ctx.request.get('Cookie').split('=').splice(1).join('');

        log('validating request, token:', token);
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `token=${token}`,
            agent: selfSignedAgent,
        };

        const validToken = await fetch(config.auth.validateEndpoint, opts).then(res => res.json());
        const isValid = validToken.active === true;

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
            ctx.response.body = { message: 'Forbidden' };
            ctx.response.status = 401;
            return;
        }

        ctx.response.body = { isValid };
        ctx.response.status = isValid ? 200 : 404;
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
            }]);
        });

        // Route requests according to the routes above
        app.use(router.routes());
        app.use(router.allowedMethods());
    };

    mountRoutes();

    //
    // Post-route-handler processing
    //
    // Allow any origin by echoing the origin back to the client
    // TODO: we should remove this in production and use k8s to route the responses such that the
    // root serves the UI and all non-root requests serve the API.
    if (config.cors.reflectOrigin) {
        app.use(async (ctx, next) => {
            if (undefined !== ctx.request.headers.origin) {
                ctx.response.set({
                    'Access-Control-Allow-Origin': ctx.request.headers.origin,
                    'Access-Control-Allow-Credentials': true,
                });
            }
            await next();
        });
    }

    return app;
};

module.exports = createServer;
