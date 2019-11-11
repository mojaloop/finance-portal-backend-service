const handler = (router, routesContext) => {
    router.get('/dfsps', async (ctx, next) => {
        const dfsps = await routesContext.db.getDfsps();
        ctx.response.body = dfsps;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
