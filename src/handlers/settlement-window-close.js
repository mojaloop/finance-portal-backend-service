const axios = require('axios');
const sleep = require('sleep-promise');

const handlerHelpers = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-close/:settlementWindowId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        const resp = await axios.post(
            `${routesContext.config.centralSettlementsEndpoint}/settlementWindows/${ctx.params.settlementWindowId}`,
            {
                state: 'CLOSED',
                reason: 'Finance portal user request',
            },
            {
                validateStatus: null,
            },
        );

        ctx.response.status = resp.status;

        if (resp.status === 200) {
            // this delay is introduced in order to give the central settlement API enough time
            // to close the window
            // TODO revise the implementation of the central settlement API so it sends back an
            // acknowledgment somehow
            await sleep(3000);
            ctx.response.body = await handlerHelpers.getSettlementWindows(
                routesContext,
                fromDateTime,
                toDateTime,
            );
        } else {
            ctx.response.body = resp.data;
        }

        await next();
    });
};

module.exports = handler;
