const handler = (router, routesContext) => {
    router.get('/settlement-account/:participantId', async (ctx, next) => {
        ctx.response.body = await routesContext.db
            .getSettlementAccountBalance(ctx.params.participantId);
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
