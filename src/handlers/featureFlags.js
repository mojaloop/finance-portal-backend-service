const handler = (router, routesContext) => {
    router.get('/featureflags', async (ctx, next) => {
        const flags = (routesContext.config && routesContext.config.featureFlags)
            ? routesContext.config.featureFlags
            : {};

        ctx.response.body = flags;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
