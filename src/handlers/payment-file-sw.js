const handler = (router, routesContext) => {
    router.get('/payment-file-sw/:settlementWindowId', async (ctx, next) => {
        const file = await routesContext.db
            .getPaymentFileBySettlementWindowId(ctx.params.settlementWindowId);
        ctx.response.body = file;
        ctx.response.set({
            'content-type': 'application/xml',
            'content-disposition': 'attachment',
        });
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
