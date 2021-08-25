const axios = require('axios');
const qs = require('querystring');
const sendFile = require('koa-send');
const { URL } = require('url');

const { generateReport, generateReportUrl, deleteSavedReportFile } = require('../lib/reportsUtil');

const handler = (router, routesContext) => {
    router.get('/report', async (ctx, next) => {
        const { reportId } = qs.parse(ctx.request.querystring);

        if (!reportId === '312' || !reportId === '644') {
            ctx.response.body = { error: 'Wrong report Id!' };
            ctx.response.status = 404;
            await next();
            return;
        }
        const reportUrl = new URL(routesContext.config.reportUrls[reportId]);
        ctx.log.info(`Found report URL: ${reportUrl}`);
        const completeUrl = await generateReportUrl(ctx.request, reportUrl, reportId);
        ctx.log.info(`Generated report request: ${completeUrl}`);

        try {
            const response = await axios.get(completeUrl);
            if (response.status !== 200) {
                ctx.response.body = { status: 'No Content!' };
                ctx.response.status = 204;
                await next();
                return;
            }

            const report = response.data;
            const filename = `${reportId}_report_${Date.now()}.csv`;
            await generateReport(report, filename);
            ctx.response.status = 200;
            await sendFile(ctx, filename);
            await deleteSavedReportFile(filename);
        } catch (err) {
            ctx.response.body = { error: 'Failed to get report!' };
            ctx.response.status = 500;
            await next();
            return;
        }

        await next();
    });
};

module.exports = handler;
