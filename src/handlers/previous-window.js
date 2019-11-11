const qs = require('querystring');

// Our data should come out of the query sorted, but in case something funny happens in
// between, we sort it here. The basic reason for doing so is that this is easier than auditing
// all the code in the query. Not sure what the node Array sort implementation looks like, but
// assuming it doesn't have a pathological complexity for sorted data, this sort shouldn't have
// a large cost.
const dateSortDesc = (a, b) => (a.createdDate < b.createdDate ? 1 : -1);

const handler = (router, routesContext) => {
    // Limits and positions returned are as at window closure time
    router.get('/previous-window/:participantName', async (ctx, next) => {
        const {
            fromDateTime = routesContext.db.MYSQL_MIN_DATETIME, toDateTime =
            routesContext.db.MYSQL_MAX_DATETIME,
        } = qs.parse(ctx.request.querystring);

        const { history, windows: windowArr } = await routesContext.db
            .getPreviousSettlementWindowData({
                participantName: ctx.params.participantName,
                fromDateTime,
                toDateTime,
            }).then(
                // sort limits and positions by date in descending order
                // TODO: Investigate usage below for potential bugs
                // eslint-disable-next-line
                ({history, ...rest}) => ({
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
        // ctx.response.body = windowArr.reduce((acc, w) => ({
        //     ...acc,
        //     id: w.id,
        //     open: w.open,
        //     close: w.close,
        //     [w.curr]: {
        //         payments: { num: w.numPayments, value: w.payments },
        //         receipts: { num: w.numReceipts, value: w.receipts },
        //         // Defaults (RHS of ||) here because it's possible a limit or position did not
        //         // exist before this window
        //         limit: (history[w.curr].limits.find(l => l.createdDate < w.close) ||
        //         { lim: 0 }).lim,
        //         position: (history[w.curr].positions
        //             .find(p => p.createdDate < w.close) || { value: 0 }).value,
        //     }
        // }), {});
        const result = windowArr.reduce((acc, w) => ({
            ...acc,
            id: w.id,
            open: w.open,
            close: w.close,
            payments: {
                ...acc.payments,
                [w.curr]: {
                    num: w.numPayments,
                    value: w.payments,
                },
            },
            receipts: {
                ...acc.receipts,
                [w.curr]: {
                    num: w.numReceipts,
                    value: w.receipts,
                },
            },
            limits: {
                ...acc.limits,
                [w.curr]: {
                    value: (history[w.curr].limits
                        .find(l => l.createdDate < w.close) || { lim: 0 }).lim,
                },
            },
            positions: {
                ...acc.positions,
                [w.curr]: {
                    value: (history[w.curr].positions
                        .find(p => p.createdDate < w.close) || { value: 0 }).value,
                },
            },
        }), {});

        const netPositions = Object.keys(result.payments).map(curr => ({
            [curr]: result.payments[curr].value - result.receipts[curr].value,
        }));

        result.netPositions = netPositions;

        ctx.response.body = result;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
