const casaLib = require('@mojaloop/finance-portal-lib');
const util = require('util');

const { getFxpRatesPerCurrencyChannel } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/forex/rates', async (ctx, next) => {
        try {
            const fxpRatesPerCurrencyChannel = await getFxpRatesPerCurrencyChannel(
                routesContext.config.fxpEndpoint,
            );

            ctx.response.body = fxpRatesPerCurrencyChannel;
            ctx.response.status = 200;

            await next();
        } catch (error) {
            routesContext.log('Error', util.inspect(error, { depth: 10 }));
            ctx.response.body = { msg: 'FXP API Error' };
            ctx.response.status = 502;

            await next();
        }
    });
};

module.exports = handler;
