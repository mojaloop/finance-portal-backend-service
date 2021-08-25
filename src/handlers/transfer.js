const handler = (router, routesContext) => {
    router.get('/transfer/:transferId', async (ctx, next) => {
        const res = await routesContext.db.getTransferState(ctx.params.transferId);
        if (res === null) {
            ctx.response.body = { message: 'Transfer not found' };
            ctx.response.status = 404;
        } else {
            ctx.response.body = res;
            ctx.response.status = 200;
        }
        await next();
    });

    router.get('/transfers', async (ctx, next) => {
        const res = await routesContext.db.getTransfers(ctx.query);
        if(res === null) {
            ctx.response.body = [];
        }
        else {
            ctx.response.body = res;
        }
        await next();
    });
};

module.exports = handler;
