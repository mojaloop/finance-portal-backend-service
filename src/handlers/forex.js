const casaLib = require('@mojaloop/finance-portal-lib');
const util = require('util');

const { getFxpRatesPerCurrencyChannel } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/forex/rates', async (ctx, next) => {
        let fxpRatesPerCurrencyChannel;

        try {
            fxpRatesPerCurrencyChannel = await getFxpRatesPerCurrencyChannel(
                routesContext.config.fxpEndpoint,
            );
        } catch (error) {
            routesContext.log('Error', util.inspect(error, { depth: 10 }));
            ctx.response.body = { msg: 'FXP API Error' };
            ctx.response.status = 502;

            await next();

            return;
        }

        ctx.response.body = fxpRatesPerCurrencyChannel;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
