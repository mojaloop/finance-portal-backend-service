const base64url = require('base64url');
const fs = require('fs');
const JWT = require('jsonwebtoken');
const util = require('util');

const AzureLog = require('../lib/azureLogUtil');

const dir = './secrets';
const pubKeys = fs.readdirSync(dir)
    .filter((fname) => !fs.statSync(`${dir}/${fname}`).isDirectory())
    .map((fname) => fs.readFileSync(`${dir}/${fname}`, 'utf-8'));

const handler = (router, routesContext) => {
    router.get('/validate-transfer/:transferId', async (ctx, next) => {
        const transfer = await routesContext.db.getTransferDetails(ctx.params.transferId);
        const validMessage = await AzureLog
            .getTransferMessageWithJWSSignature(routesContext.config.azureLog,
                ctx.params.transferId,
                ctx.log);
        let isValidTransfer = false;

        if (validMessage != null) {
            const body = validMessage.message.content.payload;
            const check = {
                body: base64url(JSON.stringify(body)),
                signature: validMessage.signatureHeader.signature,
                protectedHeader: validMessage.signatureHeader.protectedHeader,
            };

            const token = `${check.protectedHeader}.${check.body}.${check.signature}`;

            try {
                isValidTransfer = pubKeys.some((pubKey) => JWT.verify(token, pubKey));
            } catch (err) {
                ctx.log.error(`Error validating JWS token: ${err.stack || util.inspect(err)}`);
            }
        }

        const transferDetails = {
            transfer,
            isValidTransfer,
        };

        ctx.response.body = transferDetails;
        ctx.response.status = 200;
        await next();
    });
};

module.exports = handler;
