const handler = (router, routesContext) => {
    router.get('/payment-file/:paymentFileId', async (ctx, next) => {
        const file = await routesContext.db.getPaymentFileById(ctx.params.paymentFileId);
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
