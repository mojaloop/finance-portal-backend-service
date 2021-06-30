const qs = require('querystring');
const casaLib = require('@mojaloop/finance-portal-lib');

const Model = casaLib.settlement.api;

const handler = (router, routesContext) => {
    router.get('/settlements', async (ctx, next) => {
        const {
            fromDateTime = routesContext.db.MYSQL_MIN_DATETIME, toDateTime =
            routesContext.db.MYSQL_MAX_DATETIME,
        } = qs.parse(ctx.request.querystring);
        const api = new Model({ endpoint: routesContext.config.centralSettlementsEndpoint });
        // Central settlement service returns an HTTP 400 response in the case that there are no
        // settlements. The portal backend sanitises this response to an empty list.
        // The offending code is here: https://github.com/mojaloop/central-settlement/blob/45ecfe32d1039870aa9572e23747c24cd6d53c86/src/domain/settlement/index.js#L215
        try {
            ctx.response.body = await api.getSettlements({ fromDateTime, toDateTime });
        } catch (err) {
            if (err?.constructor?.name === 'HTTPResponseError'
             && err.getData().res.status === 400
             && err.getData()?.resp?.errorInformation?.errorCode === '3100'
             && err.getData()?.resp?.errorInformation?.errorDescription === 'Generic validation error - Settlements not found'
            ) {
                ctx.response.body = [];
            } else {
                throw err;
            }
        }
        ctx.response.status = 200;
        await next();
    });

    router.put('/settlements/:settlementId', async (ctx, next) => {
        const { startDate: fromDateTime, endDate: toDateTime } = ctx.request.body;

        const api = new Model({ endpoint: routesContext.config.centralSettlementsEndpoint });

        const filterParticipants = (ps, f) => ps
            .filter((p) => p.accounts.findIndex((a) => f(a.netSettlementAmount.amount)) !== -1)
            .map((p) => (
                { ...p, accounts: p.accounts.filter((a) => f(a.netSettlementAmount.amount)) }));

        // payers settlement amount will be positive and payees will be negative
        const getPayers = (ps) => filterParticipants(ps, (x) => x > 0);
        const getPayees = (ps) => filterParticipants(ps, (x) => x < 0);
        const payers = getPayers(ctx.request.body.participants);
        const payees = getPayees(ctx.request.body.participants);
        const newParticipantsAccountState = (ps, reason, state) => ps.map((p) => ({
            ...p,
            accounts: p.accounts.map((a) => ({ id: a.id, reason, state })),
        }));

        const payerParticipants = newParticipantsAccountState(payers, 'Payee: SETTLED, settlement: SETTLED', 'SETTLED');
        const payeeParticipants = newParticipantsAccountState(payees, 'Payee: SETTLED, settlement: SETTLED', 'SETTLED');
        const allParticipants = newParticipantsAccountState(ctx.request.body.participants, 'Payee: SETTLED, settlement: SETTLED', 'SETTLED');
        // TODO: handle the error cases
        try {
            await api.putSettlement(ctx.params.settlementId, { participants: payerParticipants });
            await api.putSettlement(ctx.params.settlementId, { participants: payeeParticipants });
            await api.putSettlement(ctx.params.settlementId, { participants: allParticipants });
            ctx.response.status = 200;
        } catch (err) {
            ctx.response.status = 500;
        } finally {
            const settlements = await api.getSettlements({ fromDateTime, toDateTime });
            const updatedSettlement = settlements
                .filter((a) => a.id.toString() === ctx.params.settlementId);
            ctx.response.body = updatedSettlement[0] || {};
        }
        await next();
    });

    // TODO: support date range
    // TODO: use @mojaloop/finance-portal-lib in the front-end and remove this handler
    // TODO: go to the db to get exactly what we want, in the format we want it?
    router.get('/settlements/:participantId', async (ctx, next) => {
        const {
            fromDateTime = routesContext.db.MYSQL_MIN_DATETIME, toDateTime =
            routesContext.db.MYSQL_MAX_DATETIME,
        } = qs.parse(ctx.request.querystring);
        const api = new Model({ endpoint: routesContext.config.centralSettlementsEndpoint });
        const settlements = await api.getSettlements({ fromDateTime, toDateTime });
        ctx.response.body = settlements.filter(
            (s) => s.participants.some((p) => p.id === parseInt(ctx.params.participantId, 10)),
        );
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
