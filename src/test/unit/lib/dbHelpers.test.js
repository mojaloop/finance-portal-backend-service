const { sumAllParticipants, convertParticipantsAmountsToStrings } = require('../../../lib/dbHelpers');

const transfers = [
    {
        fspId: 'DFSPEUR',
        inAmount: '-27.0000',
        currency: 'EUR',
        outAmount: 0,
        netAmount: '-27.0000',
    },
    {
        fspId: 'DFSPMAD',
        inAmount: 0,
        currency: 'MAD',
        outAmount: '323.9700',
        netAmount: '323.9700',
    },
    {
        fspId: 'testfsp3',
        inAmount: 0,
        currency: 'EUR',
        outAmount: '27.0000',
        netAmount: '27.0000',
    },
    {
        fspId: 'testfsp4',
        inAmount: '-323.9700',
        currency: 'MAD',
        outAmount: 0,
        netAmount: '-323.9700',
    },
];

describe('db helpers: ', () => {
    it('should return an object with the total per currency', () => {
        const totalPerCurrency = { EUR: 27, MAD: 0 };
        expect(sumAllParticipants(transfers)).toEqual(totalPerCurrency);
    });

    it('should format all currencies to be fixed strings', () => {
        const totalPerCurrency = { EUR: 27, MAD: 323.97 };
        const totalPerCurrencyFixedString = [{ EUR: '27.0000' }, { MAD: '323.9700' }];
        expect(convertParticipantsAmountsToStrings(totalPerCurrency))
            .toEqual(totalPerCurrencyFixedString);
    });
});
