const casaLib = require('@mojaloop/finance-portal-lib');

const { getParticipantAccounts, setNDC, getNDC } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/netdebitcap/:participantName', async (ctx, next) => {
        const accounts = await getParticipantAccounts(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName,
        );
        const positionAccounts = accounts.filter(a => a.ledgerAccountType === 'POSITION'
            && a.isActive === 1);
        const ndc = await Promise.all(positionAccounts.map(async (acc) => {
            const limit = await getNDC(
                routesContext.config.centralLedgerEndpoint,
                ctx.params.participantName,
                acc.currency,
                routesContext.log,
            );
            acc.netDebitCap = limit.limit.value;
            return acc;
        }));
        ctx.response.body = ndc;
        ctx.response.status = 200;
        await next();
    });

    router.post('/netdebitcap/:participantName/', async (ctx, next) => {
        await setNDC(
            routesContext.config.centralLedgerEndpoint,
            ctx.params.participantName,
            ctx.request.body.currency,
            ctx.request.body.newValue,
            routesContext.log,
        );
        const accounts = await getParticipantAccounts(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName,
        );
        const positionAccounts = accounts
            .filter(a => a.ledgerAccountType === 'POSITION' && a.id === ctx.request.body.accountId);
        const ndc = await Promise.all(positionAccounts.map(async (acc) => {
            const limit = await getNDC(
                routesContext.config.centralLedgerEndpoint,
                ctx.params.participantName,
                acc.currency,
                routesContext.log,
            );
            acc.netDebitCap = limit.limit.value;
            return acc;
        }));
        [ctx.response.body] = ndc;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
