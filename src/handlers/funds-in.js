const casaLib = require('@mojaloop/finance-portal-lib');

const { HTTPResponseError } = casaLib.requests;
const { participantFundsInReserve } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.post('/funds-in/:participantName/:accountId', async (ctx, next) => {
        try {
            ctx.response.body = await participantFundsInReserve(
                routesContext.config.centralLedgerEndpoint,
                ctx.params.participantName,
                ctx.params.accountId,
                ctx.request.body.amount,
                'Admin portal funds in request',
                ctx.request.body.currency,
            );
            ctx.response.status = 200;
        } catch (err) {
            if (err instanceof HTTPResponseError && err.getData().resp.message === 'Participant is currently set inactive') {
                ctx.response.status = 400;
                ctx.response.body = err.getData();
            } else {
                throw err;
            }
        }
        await next();
    });
};

module.exports = handler;
