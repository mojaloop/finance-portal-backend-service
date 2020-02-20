const axios = require('axios');

const handlerHelpers = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-close/:settlementWindowId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        try {
            const resp = await axios.post(`${routesContext.config.externalSettlementsEndpoint}/tmf/settlement-windows/current/close`, {});
            if (resp.status === 202) {
                ctx.response.status = 200;
            } else {
                ctx.response.status = 500;
            }
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
