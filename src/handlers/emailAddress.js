const { getParticipantEmailAddresses, updateEmailAddress } = require('@mojaloop/finance-portal-lib').admin.api;

const handler = (router, routesContext) => {
    router.get('/emailAddress/:participantName', async (ctx, next) => {
        const emailAddresses = await getParticipantEmailAddresses(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName,
        );
        ctx.response.body = emailAddresses;
        ctx.response.status = 200;
        await next();
    });

    router.put('/emailaddress/:participantName/', async (ctx, next) => {
        const { participantName } = ctx.params;
        const { emailType } = ctx.request.body;
        await updateEmailAddress(
            routesContext.config.centralLedgerEndpoint,
            participantName,
            emailType,
            ctx.request.body.newValue,
        );
        const emailAddresses = await getParticipantEmailAddresses(
            routesContext.config.centralLedgerEndpoint, participantName,
        );
        const emailAddress = emailAddresses.filter((a) => a.type === emailType);
        [ctx.response.body] = emailAddress;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
