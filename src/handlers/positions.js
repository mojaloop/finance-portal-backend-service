const handler = (router, routesContext) => {
    router.get('/positions/:participantId', async (ctx, next) => {
        ctx.response.body = await routesContext.db.getPositionInfo(ctx.params.participantId);
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
