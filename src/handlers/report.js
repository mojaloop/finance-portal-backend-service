const fetch = require('node-fetch');
const qs = require('querystring');
const sendFile = require('koa-send');
const { URL, URLSearchParams } = require('url');
const {
    deleteSavedReportFile,
    generateReportFromResponse,
} = require('../lib/reportsUtil');

const handler = (router, routesContext) => {
    router.get('/report', async (ctx, next) => {
        const { name, type } = qs.parse(ctx.request.querystring);

        if (!name || !type) {
            ctx.response.body = { error: 'A required query param is missing. Required query params: [name, type]' };
            ctx.response.status = 400;

            await next();
            return;
        }

        const query = qs.parse(ctx.request.querystring);
        delete query.name;
        delete query.type;

        const reportUrl = new URL(routesContext.config.reportUrls.settlement);
        routesContext.log(`Found report URL: ${reportUrl}`);

        const reportParams = new URLSearchParams(query);
        const completeUrl = `${reportUrl}${name}.${type}?${reportParams}`;
        routesContext.log(`Generated report request: ${completeUrl}`);

        const filename = `report_${name}_${Date.now()}.${type}`;

        try {
            const opts = {
                method: 'GET',
            };

            const response = await fetch(completeUrl, opts);

            if (response.status !== 200) {
                ctx.response.body = { status: 'No Content!' };
                ctx.response.status = 204;
                await next();
                return;
            }

            await generateReportFromResponse(response.body, filename);

            ctx.response.status = 200;
            ctx.response.set({
                'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=${filename}`,
            });

            await sendFile(ctx, filename);
        } catch (err) {
            routesContext.log(err);

            ctx.response.body = { error: 'Failed to get report!' };
            ctx.response.status = 500;

            await next();
            return;
        } finally {
            await deleteSavedReportFile(filename);
        }

        await next();
    });
};

module.exports = handler;
