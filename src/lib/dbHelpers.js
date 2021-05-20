// Sum all the amounts for all given currencies into an array of objects.
const sumAllParticipants = (participantAmount) => participantAmount.filter((a) => !a.fspId.includes('DFSP'))
    .reduce((total, participantAmnt) => {
        const amounts = total;
        if (Object.keys(total).length === 0) {
            amounts[participantAmnt.currency] = parseFloat(participantAmnt.outAmount);
            return amounts;
        }
        amounts[participantAmnt.currency] = Object.keys(total)
            .includes(participantAmnt.currency)
            ? amounts[participantAmnt.currency] + parseFloat(participantAmnt.outAmount)
            : parseFloat(participantAmnt.outAmount);
        return amounts;
    }, {});

// Convert the result from sumAllParticipants into fixed strings
const convertParticipantsAmountsToStrings = (totalAmounts) => Object.keys(totalAmounts)
    .map((currency) => ({ [currency]: totalAmounts[currency].toFixed(4).toString() }));

module.exports = {
    sumAllParticipants,
    convertParticipantsAmountsToStrings,
};
