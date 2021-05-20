const qs = require('querystring');

// Our data should come out of the query sorted, but in case something funny happens in
// between, we sort it here. The basic reason for doing so is that this is easier than auditing
// all the code in the query. Not sure what the node Array sort implementation looks like, but
// assuming it doesn't have a pathological complexity for sorted data, this sort shouldn't have
// a large cost.
const dateSortDesc = (a, b) => (a.createdDate < b.createdDate ? 1 : -1);

const handler = (router, routesContext) => {
// Limits and positions returned are as at window closure time
    router.get('/historical-window-summary/:participantName', async (ctx, next) => {
        const {
            fromDateTime = routesContext.db.MYSQL_MIN_DATETIME, toDateTime =
            routesContext.db.MYSQL_MAX_DATETIME,
        } = qs.parse(ctx.request.querystring);

        // Build up a result object that looks like this:
        // {
        //     windows: {
        //         id: {
        //             XOF: {
        //                 payments: { num: a, value: b },
        //                 receipts: { num: a, value: b },
        //                 limit: x,
        //                 position: y
        //             }, ...
        //         }, ...
        //     },
        //     average: {
        //         XOF: {
        //             payments: { num: a, value: b },
        //             receipts: { num: a, value: b },
        //             limit: x,
        //             position: y
        //         }, ...
        //     }
        // }

        const { history, windows: windowArr, currencies } = await routesContext.db
            .getHistoricalSettlementWindowData({
                participantName: ctx.params.participantName,
                fromDateTime,
                toDateTime,
            }).then(
                // TODO: Investigate usage below for potential bugs
                // eslint-disable-next-line
                ({ history, ...rest }) => ({
                    ...rest,
                    history: history.reduce((pv, [curr, limits, positions]) => ({
                        ...pv,
                        [curr]: {
                            limits: limits.sort(dateSortDesc),
                            positions: positions.sort(dateSortDesc),
                        },
                    }), {}),
                }),
            );

        const windows = windowArr.reduce((acc, w) => ({
            ...acc,
            [w.id]: {
                ...acc[w.id],
                open: w.open,
                close: w.close,
                [w.curr]: {
                    payments: { num: w.numPayments, value: w.payments },
                    receipts: { num: w.numReceipts, value: w.receipts },
                    // Defaults (RHS of ||) here because it's possible a limit or position did not
                    // exist before this window
                    limit: (history[w.curr].limits
                        .find((l) => l.createdDate < w.close) || { lim: 0 }).lim,
                    position: (history[w.curr].positions
                        .find((p) => p.createdDate < w.close) || { value: 0 }).value,
                },
            },
        }), {});

        // Note that windowCount should never be zero when currencies is a non-empty array;
        // therefore the following code should never cause a divide by zero
        const windowCount = Object.keys(windows).length;
        const average = Object.assign(...currencies.map((curr) => ({
            [curr]: {
                payments: {
                    num: windowArr.reduce((pv, w) => pv + w.numPayments, 0) / windowCount,
                    value: windowArr.reduce((pv, w) => pv + w.payments, 0) / windowCount,
                },
                receipts: {
                    num: windowArr.reduce((pv, w) => pv + w.numReceipts, 0) / windowCount,
                    value: windowArr.reduce((pv, w) => pv + w.receipts, 0) / windowCount,
                },
                limit: Object.values(windows)
                    .reduce((pv, w) => w[curr].limit + pv, 0) / windowCount,
                position: Object.values(windows)
                    .reduce((pv, w) => w[curr].position + pv, 0) / windowCount,
            },
        })));

        ctx.response.body = {
            windows,
            average,
        };
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
