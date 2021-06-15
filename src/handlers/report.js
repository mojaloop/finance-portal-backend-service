const fetch = require("node-fetch");
const qs = require("querystring");
const sendFile = require("koa-send");
const { URL } = require("url");
const {
  deleteSavedReportFile,
  generateReportFromResponse,
} = require("../lib/reportsUtil");

const handler = (router, routesContext) => {
  router.get("/report", async (ctx, next) => {
    const { settlementId } = qs.parse(ctx.request.querystring);

    const reportUrl = new URL(routesContext.config.reportUrls["settlement"]);
    routesContext.log(`Found report URL: ${reportUrl}`);
    const completeUrl = `${reportUrl}?settlementId=${settlementId}`;
    routesContext.log(`Generated report request: ${completeUrl}`);
    const opts = {
      method: "GET",
    };

    const filename = `report_settlementId-${settlementId}_${Date.now()}.xlsx`;

    try {
      const response = await fetch(completeUrl, opts);

      if (response.status !== 200) {
        ctx.response.body = { status: "No Content!" };
        ctx.response.status = 204;
        await next();
        return;
      }

      await generateReportFromResponse(response.body, filename);

      ctx.response.status = 200;
      ctx.response.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=" + filename,
      });

      await sendFile(ctx, filename);
    } catch (err) {
      console.log(err);
      routesContext.log(err);

      ctx.response.body = { error: "Failed to get report!" };
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
