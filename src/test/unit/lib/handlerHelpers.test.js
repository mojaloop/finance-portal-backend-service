const Big = require('big.js');
const {
    getSettlementAccountId, bigifyPaymentMatrix, getPayees, getPayers, getParticipantName,
    newParticipantsAccountStateAndReason, getAllParticipantNames, segmentParticipants,
    getParticipantAccounts,
} = require('../../../lib/handlerHelpers');
const participants = require('../mocks/participants.json');
const dfsps = require('../mocks/dfsps.json');

describe('Handler Helpers', () => {
    describe('getParticipantAccounts', () => {
        it('should correctly return the accounts array of a given participant by its name', () => {
            const expected = [
                {
                    id: 41,
                    ledgerAccountType: 'POSITION',
                    currency: 'EUR',
                    isActive: 1,
                    createdDate: '2019-07-30T22:26:44.000Z',
                    createdBy: 'unknown',
                },
                {
                    id: 42,
                    ledgerAccountType: 'SETTLEMENT',
                    currency: 'EUR',
                    isActive: 1,
                    createdDate: '2019-07-30T22:26:44.000Z',
                    createdBy: 'unknown',
                },
            ];
            const actual = getParticipantAccounts(dfsps, 'DFSP1');
            expect(actual).toEqual(expected);
        });
    });
    describe('segmentParticipants', () => {
        it('should correctly return an object of participants segmented by pay direction', () => {
            const expected = {
                allParticipants: [
                    {
                        accounts: [
                            {
                                id: 3,
                                reason: 'All Participants: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 11,
                    },
                    {
                        accounts: [
                            {
                                id: 5,
                                reason: 'All Participants: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 15,
                    },
                    {
                        accounts: [
                            {
                                id: 33,
                                reason: 'All Participants: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 640,
                    },
                    {
                        accounts: [
                            {
                                id: 35,
                                reason: 'All Participants: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 641,
                    },
                ],
                payeeParticipants: [
                    {
                        accounts: [
                            {
                                id: 5,
                                reason: 'Payee: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 15,
                    },
                    {
                        accounts: [
                            {
                                id: 35,
                                reason: 'Payee: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 641,
                    },
                ],
                payerParticipants: [
                    {
                        accounts: [
                            {
                                id: 3,
                                reason: 'Payer: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 11,
                    },
                    {
                        accounts: [
                            {
                                id: 33,
                                reason: 'Payer: SETTLED, settlement: SETTLED',
                                state: 'SETTLED',
                            },
                        ],
                        id: 640,
                    },
                ],
            };
            const actual = segmentParticipants(participants);
            expect(actual).toEqual(expected);
        });
    });
    describe('getAllParticipantNames', () => {
        it('should correctly return an array of all participants\' names present in a given'
            + 'payment matrix', () => {
            const paymentMatrix = [['XOF', '11', '1'], ['XOF', '15', '-1']];
            const expected = ['payerfsp', 'payeefsp'];
            const actual = getAllParticipantNames(dfsps, participants, paymentMatrix);
            expect(actual).toEqual(expected);
        });
    });
    describe('newParticipantsAccountStateAndReason', () => {
        it('should correctly return a new participants array with a given account state and reason',
            () => {
                const expected = [
                    {
                        accounts: [
                            {
                                id: 3,
                                reason: 'n/a',
                                state: 'SETTLED',
                            },
                        ],
                        id: 11,
                    },
                    {
                        accounts: [
                            {
                                id: 5,
                                reason: 'n/a',
                                state: 'SETTLED',
                            },
                        ],
                        id: 15,
                    },
                    {
                        accounts: [
                            {
                                id: 33,
                                reason: 'n/a',
                                state: 'SETTLED',
                            },
                        ],
                        id: 640,
                    },
                    {
                        accounts: [
                            {
                                id: 35,
                                reason: 'n/a',
                                state: 'SETTLED',
                            },
                        ],
                        id: 641,
                    },
                ];
                const actual = newParticipantsAccountStateAndReason(participants, 'n/a',
                    'SETTLED');
                expect(actual).toEqual(expected);
            });
    });
    describe('getParticipantName', () => {
        it('should correctly get the participant name given a participantId and list of DFSP\'s',
            () => {
                const participantId = '11';
                const expected = 'payerfsp';
                const actual = getParticipantName(dfsps, participants, participantId);
                expect(actual).toEqual(expected);
            });
    });
    describe('getPayees', () => {
        it('should correctly return the list of payees', () => {
            const expected = [
                {
                    accounts: [
                        {
                            id: 5,
                            netSettlementAmount: {
                                amount: -1,
                                currency: 'XOF',
                            },
                            reason: 'Transfers committed for payer & payee',
                            state: 'PS_TRANSFERS_COMMITTED',
                        },
                    ],
                    id: 15,
                },
                {
                    accounts: [
                        {
                            id: 35,
                            netSettlementAmount: {
                                amount: -80,
                                currency: 'XOF',
                            },
                            reason: 'Transfers committed for payer & payee',
                            state: 'PS_TRANSFERS_COMMITTED',
                        },
                    ],
                    id: 641,
                },
            ];
            const actual = getPayees(participants);
            expect(actual).toEqual(expected);
        });
    });
    describe('getPayers', () => {
        it('should correctly return the list of payers', () => {
            const expected = [
                {
                    accounts: [
                        {
                            id: 3,
                            netSettlementAmount: {
                                amount: 1,
                                currency: 'XOF',
                            },
                            reason: 'Transfers committed for payer & payee',
                            state: 'PS_TRANSFERS_COMMITTED',
                        },
                    ],
                    id: 11,
                },
                {
                    accounts: [
                        {
                            id: 33,
                            netSettlementAmount: {
                                amount: 80,
                                currency: 'XOF',
                            },
                            reason: 'Transfers committed for payer & payee',
                            state: 'PS_TRANSFERS_COMMITTED',
                        },
                    ],
                    id: 640,
                },
            ];
            const actual = getPayers(participants);
            expect(actual).toEqual(expected);
        });
    });
    describe('bigifyPaymentMatrix', () => {
        it('should correctly return a copy of the payment matrix with Big.js typed amounts', () => {
            const paymentMatrix = [['XOF', '17', '-1'], ['XOF', '18', '1']];
            const expected = [['XOF', '17', Big('-1')], ['XOF', '18', Big('1')]];
            const actual = bigifyPaymentMatrix(paymentMatrix);
            expect(actual).toEqual(expected);
        });
    });
    describe('getSettlementAccountId', () => {
        it('should correctly retrieve the settlement account\'s ID', () => {
            const accounts = [
                {
                    id: 21,
                    ledgerAccountType: 'POSITION',
                    currency: 'USD',
                    isActive: 0,
                    value: 458,
                    reservedValue: 0,
                    changedDate: '2019-05-13T17:40:01.000Z',
                },
                {
                    id: 22,
                    ledgerAccountType: 'SETTLEMENT',
                    currency: 'USD',
                    isActive: 1,
                    value: -60000,
                    reservedValue: 0,
                    changedDate: '2019-05-13T17:40:01.000Z',
                },
                {
                    id: 3,
                    ledgerAccountType: 'POSITION',
                    currency: 'XOF',
                    isActive: 1,
                    value: 24990,
                    reservedValue: 0,
                    changedDate: '2019-07-30T08:01:15.000Z',
                },
                {
                    id: 4,
                    ledgerAccountType: 'SETTLEMENT',
                    currency: 'XOF',
                    isActive: 1,
                    value: -81577.5,
                    reservedValue: 0,
                    changedDate: '2019-03-30T22:56:44.000Z',
                },
            ];
            const currency = 'XOF';
            const expected = 4;
            const actual = getSettlementAccountId(accounts, currency);
            expect(actual).toEqual(expected);
        });
    });
});
