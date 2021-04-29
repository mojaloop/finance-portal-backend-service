const handler = (router, routesContext) => {
    router.get('/settlement-account/:participantId', async (ctx, next) => {
        ctx.response.body = await routesContext.db
            .getSettlementAccountBalance(ctx.params.participantId);
        ctx.response.status = 200;
        await next();
    });

    router.put('/settlement-account/:participantId', async (ctx, next) => {
        try {
            await routesContext.db
                .putSettlementAccountBalance(ctx.params.participantId, ctx.request.body.balance);
            ctx.response.status = 200;
        } catch (err) {
            ctx.response.status = 500;
        } finally {
            ctx.response.body = await routesContext.db
                .getSettlementAccountBalance(ctx.params.participantId);
        }
        await next();
    });    
};

module.exports = handler;
