// The cookie _should_ look like:
//   mojaloop-portal-token=abcde
// But when doing local development, the cookie may look like:
//   some-rubbish=whatever; mojaloop-portal-token=abcde; other-rubbish=defgh
// because of other cookies set on the host. So we take some more care extracting it here.
const getTokenCookieFromRequest = (ctx) => ctx.request
    // get the cookie header string, it'll look like
    // some-rubbish=whatever; token=abcde; other-crap=defgh
    .get('Cookie')
    // Split it so we have some key-value pairs that look like
    // [['some-rubbish', 'whatever'], ['token', 'abcde'], ['other-rubbish', 'defgh']]
    ?.split(';')
    ?.map((cookie) => cookie.trim().split('='))
    // Find the token cookie and get its value
    // We assume there's only one instance of our cookie
    ?.find(([name]) => name === ctx.constants.TOKEN_COOKIE_NAME)?.[1];

const getSettlementWindows = async (routesContext, fromDateTime, toDateTime,
    settlementWindowId) => {
    const result = await routesContext.db.getSettlementWindows({ fromDateTime, toDateTime });

    let filteredResult = result;

    if (settlementWindowId != null) {
        filteredResult = result
            .filter((s) => s.settlementWindowId.toString() === settlementWindowId);
    }

    const multipleRows = filteredResult
        .map((e) => e.settlementWindowId).map((e, i, self) => {
            if (self.indexOf(e) !== self.lastIndexOf(e)) {
                return filteredResult[i];
            }
            return null;
        }).filter((e) => e);

    const difference = filteredResult
        .filter((n) => !multipleRows
            .some((n2) => n.settlementWindowId === n2.settlementWindowId));

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

module.exports = {
    getSettlementWindows,
    getTokenCookieFromRequest,
};
