const axios = require('axios');
const sleep = require('sleep-promise');

const handlerHelpers = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-close/:settlementWindowId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        try {
            const resp = await axios.post(
                `${routesContext.config.centralSettlementsEndpoint}/settlementWindows/${ctx.params.settlementWindowId}`,
                {
                    state: 'CLOSED',
                    reason: 'Finance portal user request',
                },
            );
            if (resp.status === 200) {
                ctx.response.status = 200;
            } else {
                ctx.response.status = 502;
            }
        } catch (err) {
            ctx.response.status = 502;
        } finally {
            // this delay is introduced in order to give the external settlement API enough time
            // to close the window
            // TODO revise the implementation of the external settlement API so it sends back an
            //  acknowledgment somehow
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
