const handler = (router, routesContext) => {
    router.get('/featureflags', async (ctx, next) => {
        let flags = {};

        // dont barf if we dont have config or config.featureFlags set
        if (routesContext.config && routesContext.config.featureFlags) {
            flags = routesContext.config.featureFlags;
        }

        ctx.response.body = flags;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
