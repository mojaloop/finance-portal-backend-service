const casaLib = require('@mojaloop/finance-portal-lib');

const { getParticipantAccounts, getAccountById } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/accounts/:participantName/:id', async (ctx, next) => {
        ctx.response.body = await getAccountById(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName, ctx.params.id,
        );
        ctx.response.status = 200;
        await next();
    });

    router.get('/accounts/:participantName', async (ctx, next) => {
        const accounts = await getParticipantAccounts(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName,
        );
        ctx.response.body = accounts.filter((a) => a.isActive === 1);
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
