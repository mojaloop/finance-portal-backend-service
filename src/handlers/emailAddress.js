const casaLib = require('@mojaloop/finance-portal-lib');

const { getParticipantEmailAddresses, updateEmailAddress } = casaLib.admin.api;

const handler = (router, routesContext) => {
    router.get('/emailAddress/:participantName', async (ctx, next) => {
        const emailAddresses = await getParticipantEmailAddresses(
            routesContext.config.centralLedgerEndpoint, ctx.params.participantName,
            routesContext.log,
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
            routesContext.log,
        );
        const emailAddresses = await getParticipantEmailAddresses(
            routesContext.config.centralLedgerEndpoint, participantName, routesContext.log,
        );
        const emailAddress = emailAddresses.filter(a => a.type === emailType);
        [ctx.response.body] = emailAddress;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
