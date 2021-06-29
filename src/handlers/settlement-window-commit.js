const portalLib = require('@mojaloop/finance-portal-lib');
const sleep = require('sleep-promise');

const { commitSettlementWindow } = portalLib.admin.api;
const { getSettlementWindows } = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-commit/:settlementWindowId', async (ctx, next) => {
        const { settlementId, startDate, endDate } = ctx.request.body;
        let mostRecentSettlementWindow;

        try {
            await commitSettlementWindow(
                routesContext.config.externalSettlementsEndpoint,
                Number(settlementId),
            );
        } catch (error) {
            ctx.log.child({ error }).error('Settlement API Error');
            ctx.response.body = { msg: 'Settlement API Error' };
            ctx.response.status = 502;

            await next();
            return;
        }

        // this delay is introduced in order to give the external settlement API enough time
        // to settle the window
        // TODO revise the implementation of the external settlement API so it sends back an
        //  acknowledgment somehow
        await sleep(3000);

        // Attempt to return the most recent settlement window
        try {
            const settlementWindows = await getSettlementWindows(
                routesContext,
                startDate,
                endDate,
                ctx.params.settlementWindowId,
            );

            [mostRecentSettlementWindow] = settlementWindows;
        } catch (error) {
            ctx.log.child({ error }).error('An error occurred during getSettlementWindow');
        }

        ctx.response.body = mostRecentSettlementWindow || {};
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
