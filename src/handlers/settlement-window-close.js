const axios = require('axios');

const handlerHelpers = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-close/:settlementWindowId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        try {
            await axios.post(`${routesContext.config.settlementManagementEndpoint}/close-window`, {});
            ctx.response.status = 200;
        } catch (err) {
            ctx.response.status = 500;
        } finally {
            ctx.response.body = await handlerHelpers.getSettlementWindows(
                routesContext,
                fromDateTime,
                toDateTime,
            );
        }
        await next();
    });
};

module.exports = handler;
