const portalLib = require('@mojaloop/finance-portal-lib');
const util = require('util');

const { commitSettlementWindow } = portalLib.admin.api;
const { getSettlementWindows } = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-commit/:settlementWindowId', async (ctx, next) => {
        const { startDate, endDate } = ctx.request.body;
        let mostRecentSettlementWindow;

        try {
            await commitSettlementWindow(
                routesContext.config.settlementsEndpoint,
                ctx.params.settlementWindowId,
            );
        } catch (error) {
            routesContext.log('Settlement API Error', util.inspect(error, { depth: 10 }));
            ctx.response.body = { msg: 'Settlement API Error' };
            ctx.response.status = 502;

            await next();
            return;
        }

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
            routesContext.log(`An error occurred during getSettlementWindow: ${error.message}`);
        }

        ctx.response.body = mostRecentSettlementWindow || {};
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
