const qs = require('querystring');
const casaLib = require('@mojaloop/finance-portal-lib');

const handlerHelpers = require('../lib/handlerHelpers');

const Model = casaLib.settlement.api;

const handler = (router, routesContext) => {
    router.get('/settlement-windows', async (ctx, next) => {
        const {
            fromDateTime = routesContext.db.MYSQL_MIN_DATETIME,
            toDateTime = routesContext.db.MYSQL_MAX_DATETIME,
        } = qs.parse(ctx.request.querystring);

        ctx.response.body = await handlerHelpers.getSettlementWindows(routesContext, fromDateTime,
            toDateTime);
        ctx.response.status = 200;
        await next();
    });

    router.get('/settlement-windows/:settlementWindowId', async (ctx, next) => {
        const settlementWindow = await routesContext
            .db.getSettlementWindowInfo(ctx.params.settlementWindowId);

        try {
            const api = new Model({ endpoint: routesContext.config.settlementsEndpoint });
            const settlement = await api.getSettlements({
                settlementWindowId: ctx.params.settlementWindowId,
            });
            settlementWindow.settlement = (settlement.length === 1 ? settlement[0] : {});
        } catch (error) {
            routesContext.log(error);
            settlementWindow.settlement = {};
        }
        ctx.response.body = settlementWindow;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
