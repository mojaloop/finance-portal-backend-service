const casaLib = require('@mojaloop/finance-portal-lib');

const { getParticipants, setParticipantIsActiveFlag } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/participants', async (ctx, next) => {
        ctx.response.body = await getParticipants(routesContext.config.centralLedgerEndpoint);
        ctx.response.status = 200;
        await next();
    });

    router.get('/participants/:participantId/isActive', async (ctx, next) => {
        ctx.response.body = await routesContext.db
            .getParticipantIsActiveFlag(ctx.params.participantId);
        ctx.response.status = 200;
        await next();
    });

    router.put('/participants/:participantId/isActive', async (ctx, next) => {
        try {
            await setParticipantIsActiveFlag(
                routesContext.config.centralLedgerEndpoint,
                ctx.request.body.participantName,
                ctx.request.body.isActive !== 0,
            );
        } catch (err) {
            ctx.response.body = await routesContext.db
                .getParticipantIsActiveFlag(ctx.params.participantId);
            ctx.response.status = 500;
            await next();
            return;
        }
        ctx.response.body = await routesContext.db
            .getParticipantIsActiveFlag(ctx.params.participantId);
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
