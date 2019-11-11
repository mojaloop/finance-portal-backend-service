const handler = (router, routesContext) => {
    router.get('/current-window/:participantId', async (ctx, next) => {
        const window = await routesContext.db
            .getCurrentSettlementWindowInfo(ctx.params.participantId);
        // Set default payments & receipts
        window.payments = window.payments === undefined ? {
            numTransactions: 0,
            senderAmount: '0',
        } : window.payments;
        window.receipts = window.receipts === undefined ? {
            numTransactions: 0,
            senderAmount: '0',
        } : window.receipts;
        ctx.response.body = window;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
