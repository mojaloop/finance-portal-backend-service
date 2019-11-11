const qs = require('querystring');

const handler = (router, routesContext) => {
    // TODO: possible to parametrise this query so that the user can specify which fields they want
    // returned. I.e.:
    // /payment-file-list?fields=settlementFileId,settlementId,createdDate,sentDate,settlementFile
    // Could then change the interface to just:
    // /payment-file
    //    ?fields=settlementFileId,settlementId,createdDate,sentDate,settlementFile
    //    ?id=12345
    //    ?max=100
    //    ?fromDateTime=
    //    ?toDateTime=
    //
    // Currently, takes fromDateTime and toDateTime querystring parameters optionally
    // All of the following date formats should work for both fromDateTime and toDateTime:
    //   /payment-file-list?fromDateTime=2019-02-14T23:10:00.000Z
    //   /payment-file-list?fromDateTime=2019-02-14
    //   /payment-file-list?fromDateTime=2019-02-14T23:00
    // Date ranges are closed at the beginning and open at the end. The search is as follows:
    //   createdDate >= fromDateTime AND createdDate < toDateTime
    // At the time of writing this seemed sensible. But moments later it seemed like mysql probably
    // internally converts 2019-02-02 to 2019-02-02T00:00:00, therefore making this functionality
    // redundant. Anyway, no harm..
    router.get('/payment-file-list', async (ctx, next) => {
        const q = qs.parse(ctx.request.querystring);
        const fileList = await routesContext.db.getPaymentFileList(q);
        ctx.response.body = fileList;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
