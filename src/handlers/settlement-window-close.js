const axios = require('axios');
const sleep = require('sleep-promise');

const handlerHelpers = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-close/:settlementWindowId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        try {
            const resp = await axios.post(`${routesContext.config.externalSettlementsEndpoint}/settlement-windows/current/close`, {});
            if (resp.status === 202) {
                ctx.response.status = 200;
            } else {
                ctx.response.status = 502;
            }
        } catch (err) {
            ctx.response.status = 502;
        } finally {
            // this sleep is introduced to give TMF enough time to close the window
            await sleep(3000);
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
