const Big = require('big.js');
const casaLib = require('@mojaloop/finance-portal-lib');

const { participantFundsOutPrepareReserve, participantFundsInReserve } = casaLib.admin.api;

const getSettlementWindows = async (routesContext, fromDateTime, toDateTime,
    settlementWindowId) => {
    const result = await routesContext.db.getSettlementWindows({ fromDateTime, toDateTime });

    let filteredResult = result;

    if (settlementWindowId != null) {
        filteredResult = result
            .filter(s => s.settlementWindowId.toString() === settlementWindowId);
    }

    const multipleRows = filteredResult
        .map(e => e.settlementWindowId).map((e, i, self) => {
            if (self.indexOf(e) !== self.lastIndexOf(e)) {
                return filteredResult[i];
            }
            return null;
        }).filter(e => e);

    const difference = filteredResult
        .filter(n => !multipleRows
            .some(n2 => n.settlementWindowId === n2.settlementWindowId));

    const combined = {};

    multipleRows.forEach((e) => {
        if (combined[e.settlementWindowId] == null) {
            const amountCurrency = `${e.amount} - ${e.currency}`;
            e.amountCurrency = [amountCurrency];
            combined[e.settlementWindowId] = e;
        } else {
            const existing = combined[e.settlementWindowId];
            const amountCurrency = `${e.amount} - ${e.currency}`;
            existing.amountCurrency.push(amountCurrency);
            combined[e.settlementWindowId] = existing;
        }
    });

    const settlementWindows = [...difference, ...Object.values(combined)].sort().map((e) => {
        if (Array.isArray(e.amountCurrency) && e.amountCurrency.length > 0) {
            e.amounts = e.amountCurrency.join('\n');
            delete e.amount;
            delete e.currency;
            delete e.amountCurrency;
        } else {
            e.amounts = (e.currency == null ? '' : `${e.amount} - ${e.currency}`);
            delete e.amount;
            delete e.currency;
        }
        return e;
    });
    return settlementWindows;
};

const filterParticipants = (participants, filter) => participants
    .filter(participant => participant.accounts
        .findIndex(account => filter(account.netSettlementAmount.amount)) !== -1)
    .map(participant => ({
        ...participant,
        accounts: participant.accounts
            .filter(account => filter(account.netSettlementAmount.amount)),
    }));

// Payers' settlement amounts will be positive while payees' will be negative
const getPayers = participants => filterParticipants(participants, x => x > 0);
const getPayees = participants => filterParticipants(participants, x => x < 0);

const newParticipantsAccountStateAndReason = (participants, reason, state) => participants
    .map(participant => ({
        ...participant,
        accounts: participant.accounts.map(account => ({ id: account.id, reason, state })),
    }));

const getParticipantName = (dfsps, participants, participantId) => {
    const accountIds = participants.find(participant => String(participant.id) === participantId)
        .accounts.map(account => String(account.id));
    const participant = dfsps.find((dfsp) => {
        const dfspAccountIds = dfsp.accounts.map(account => String(account.id));
        const accountPresent = dfspAccountIds
            .some(accountId => accountIds.includes(accountId));
        return accountPresent;
    });
    try {
        const { name } = participant;
        return name;
    } catch (error) {
        throw new Error('Could not find participant\'s name via its account from list of DFSP\'s');
    }
};

const getAllParticipantNames = (dfsps, participants, paymentMatrix) => paymentMatrix
    .map((payment) => {
        const [, participantId] = payment;
        const participantName = getParticipantName(dfsps, participants, participantId);
        return participantName;
    });

const getSettlementAccountId = (accounts, currency) => accounts
    .find(account => account.isActive === 1
        && account.ledgerAccountType === 'SETTLEMENT'
        && account.currency === currency)
    .id;

const getParticipantAccounts = (dfsps, participantName) => {
    try {
        const participantDfsp = dfsps.find((dfsp) => {
            const { name } = dfsp;
            const equal = name === participantName;
            return equal;
        });
        const { accounts } = participantDfsp;
        return accounts;
    } catch (error) {
        throw new Error('Could not find participant\'s accounts via its name from list of DFSP\'s');
    }
};

const processPaymentAndReturnFailedPayment = async (payment, dfsps, participants,
    centralLedgerEndpoint, log) => {
    try {
        const [currency, participantId, amount] = payment;
        const participantName = getParticipantName(dfsps, participants, participantId);
        const accounts = getParticipantAccounts(dfsps, participantName);
        const accountId = getSettlementAccountId(accounts, currency);
        if (amount < 0) { // Funds Out
            await participantFundsOutPrepareReserve(
                centralLedgerEndpoint,
                participantName,
                accountId,
                Math.abs(amount), // we need to send positive amount
                currency,
                'Admin portal funds out request',
                log,
            );
        } else { // Funds In
            await participantFundsInReserve(
                centralLedgerEndpoint,
                participantName,
                accountId,
                Math.abs(amount),
                'Admin portal funds in request',
                currency,
                log,
            );
        }
    } catch (error) {
        log(`Error while processing the funds: ${error}`);
        return payment;
    }
    return null;
};

const processPaymentsMatrixAndGetFailedPayments = async (paymentMatrix, dfsps, participants,
    centralLedgerEndpoint, log) => {
    const paymentProcessingResults = await Promise.all(paymentMatrix.map(
        async unprocessedPayment => processPaymentAndReturnFailedPayment(
            unprocessedPayment, dfsps, participants, centralLedgerEndpoint, log,
        ),
    ));
    const failedPayments = paymentProcessingResults.filter(result => result !== null);
    return failedPayments;
};

const bigifyPaymentMatrix = (paymentMatrix, createBigNum = Big) => paymentMatrix
    .map(([currency, participantId, amount]) => ([currency, participantId, createBigNum(amount)]));

const segmentParticipants = (participants) => {
    const payers = getPayers(participants);
    const payees = getPayees(participants);

    const payerParticipants = newParticipantsAccountStateAndReason(payers,
        'Payer: SETTLED, settlement: SETTLED', 'SETTLED');
    const payeeParticipants = newParticipantsAccountStateAndReason(payees,
        'Payee: SETTLED, settlement: SETTLED', 'SETTLED');
    const allParticipants = newParticipantsAccountStateAndReason(participants,
        'All Participants: SETTLED, settlement: SETTLED', 'SETTLED');

    return { payerParticipants, payeeParticipants, allParticipants };
};

module.exports = {
    getSettlementWindows,
    getSettlementAccountId,
    bigifyPaymentMatrix,
    getPayees,
    getPayers,
    getParticipantName,
    newParticipantsAccountStateAndReason,
    getAllParticipantNames,
    segmentParticipants,
    getParticipantAccounts,
    processPaymentsMatrixAndGetFailedPayments,
};
