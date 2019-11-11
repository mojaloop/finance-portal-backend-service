const {
    admin: { api: { getParticipants } }, settlement: { api: SettlementsModel },
} = require('@mojaloop/finance-portal-lib');
const {
    getSettlementWindows, bigifyPaymentMatrix, segmentParticipants,
    processPaymentsMatrixAndGetFailedPayments,
} = require('../lib/handlerHelpers');

const handler = (router, routesContext) => {
    router.put('/settlement-window-commit/:settlementWindowId', async (ctx, next) => {
        const {
            settlementId, participants, startDate: fromDateTime, endDate: toDateTime,
        } = ctx.request.body;

        // Get an exclusive connection for use in this handler. This prevents double-processing.
        // See https://modusbox.atlassian.net/browse/MOWDEV-2433
        const conn = await routesContext.db.connection.getConnection();
        // Fetch unprocessed payments and attempt to process them
        let failedPayments = [];
        try {
            routesContext.log('Getting the payment matrix to process the funds for '
                + `settlementWindowId - ${ctx.params.settlementWindowId}, `
                + `settlementId - ${settlementId}`);
            const incomingMatrixResult = await routesContext.Database
                .getPaymentMatrixForUpdate(conn, settlementId);
            const unprocessedPaymentsMatrix = incomingMatrixResult
                ? bigifyPaymentMatrix(JSON.parse(incomingMatrixResult)) : [];
            routesContext.log(`Got the payment matrix: ${unprocessedPaymentsMatrix}`);

            if (unprocessedPaymentsMatrix.length !== 0) {
                const dfsps = await getParticipants(routesContext.config.centralLedgerEndpoint,
                    routesContext.log);
                failedPayments = await processPaymentsMatrixAndGetFailedPayments(
                    unprocessedPaymentsMatrix, dfsps, participants,
                    routesContext.config.centralLedgerEndpoint, routesContext.log,
                );
            }
        } catch (error) {
            routesContext.log(error);
            routesContext.log(`Error while processing the payment matrix: ${error.message}`);
            if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
                ctx.response.status = 500;
                await next();
                return;
            }
        }

        // Commit the transaction and remove the database lock in every circumstance
        routesContext.log('Updating the state of payment matrix: settlementId - '
        + `${settlementId}, state - ${failedPayments}`);
        await routesContext.Database
            .updatePaymentMatrixState(conn, settlementId, JSON.stringify(failedPayments));
        routesContext.log('Successfully updated the state of payment matrix: settlementId - '
        + `${settlementId}, state - ${failedPayments}`);
        await conn.release();

        // Terminate and change response status if there are payments that failed to process
        if (failedPayments.length !== 0) {
            ctx.response.status = 500;
            await next();
            return;
        }

        // Otherwise, settle the window
        const api = new SettlementsModel({ endpoint: routesContext.config.settlementsEndpoint });
        const {
            payerParticipants, payeeParticipants, allParticipants,
        } = segmentParticipants(participants);
        try {
            await api.putSettlement(settlementId, { participants: payerParticipants });
            await api.putSettlement(settlementId, { participants: payeeParticipants });
            await api.putSettlement(settlementId, { participants: allParticipants });
            ctx.response.status = 200;
        } catch (error) {
            routesContext.log(`An error occurred during putSettlement: ${error.message}`);
            ctx.response.status = 500;
            await next();
            return;
        }

        // Attempt to return the most recent settlement window
        try {
            const settlementWindows = await getSettlementWindows(
                routesContext,
                fromDateTime,
                toDateTime,
                ctx.params.settlementWindowId,
            );
            const mostRecentSettlementWindow = settlementWindows[0];
            ctx.response.body = mostRecentSettlementWindow || {};
        } catch (error) {
            routesContext.log(`An error occurred during getSettlementWindow: ${error.message}`);
        }
        await next();
    });
};

module.exports = handler;
