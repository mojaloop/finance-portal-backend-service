const base64url = require('base64url');
const fs = require('fs');
const JWT = require('jsonwebtoken');
const util = require('util');

const AzureLog = require('../lib/azureLog');

const handler = (router, routesContext) => {
    router.get('/validate-transfer/:transferId', async (ctx, next) => {
        const transfer = await routesContext.db.getTransferDetails(ctx.params.transferId);
        // const validMessage = await AzureLog
        //     .getTransferMessageWithJWSSignature('c83a38ec-c572-4639-bddf-7289656ac99d');
        const validMessage = await AzureLog
            .getTransferMessageWithJWSSignature(ctx.params.transferId);
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
                const pubKeys = fs.readdirSync('secrets').map(fname => fs.readFileSync(`secrets/${fname}`, 'utf-8'));
                for (const pubKey of pubKeys) {
                    // TODO: Investigate the linting error
                    // eslint-disable-next-line
                    JWT.verify(token, pubKey, (err) => {
                        if (err) {
                            routesContext.log(`Error verifying JWS token: ${err.stack || util.inspect(err)}`);
                        } else {
                            isValidTransfer = true;
                        }
                    });
                    if (isValidTransfer === true) break;
                }
            } catch (err) {
                routesContext.log(`Error validating JWS token: ${err.stack || util.inspect(err)}`);
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
