// TODO: Remove previous line and work through linting issues at next edit

const {
    writeFile,
    unlink,
    createWriteStream,
    access,
    constants,
} = require('fs');
const { parse } = require('qs');
const { json2csv } = require('json-2-csv');

const reportIds = {
    312: [
        'senderDFSPId',
        'senderDFSPName',
        'receiverDFSPId',
        'receiverDFSPName',
        'hubTxnID',
        'transactionType',
        'natureOfTxnType',
        'requestDate',
        'createdDate',
        'modificationDate',
        'settlementDate',
        'senderCountryCurrencyCode',
        'receiverCountryCurrencyCode',
        'senderId',
        'receiverId',
        'reconciliationAmount',
        'receiverNameStatus',
        'pricingOption',
        'receiverKYCLevelStatus',
        'status',
        'errorCode',
        'senderDFSPTxnID',
        'receiverDFSPTxnID',
        'settlementWindowId',
    ],

    644: [
        'settlementWindowId',
        'fspId',
        'windowOpen',
        'windowClose',
        'numTransactions',
        'netPosition',
        'state',
    ],
};

/**
 * Save xlsx report.
 *
 * @param {Object} body      Response body from report request.
 * @param {String} filename  Name of file to save.
 * @returns {void}           Creates and saves file.
 */
const generateReportFromResponse = async (body, filename) => {
    const fileStream = createWriteStream(filename);
    await new Promise((resolve, reject) => {
        body.pipe(fileStream);
        body.on('error', reject);
        fileStream.on('finish', resolve);
    });
    body.end();
    fileStream.end();
};

/**
 * Generates a csv format of report and saves it.
 *
 * @param {Object} report    Reports from jasperserver.
 * @param {String} filename  Name of file to save.
 * @param {String} reportId  Id of requested report.
 * @returns {void}           Creates and saves file.
 */
const generateReport = async (report, filename, reportId) => {
    const options = {
        delimiter: {
            wrap: '"', // Double Quote (") character
            field: ',', // Comma field delimiter
            eol: '\n', // Newline delimiter
        },
        prependHeader: true,
        sortHeader: false,
        excelBOM: true,
        trimHeaderValues: true,
        trimFieldValues: true,
        keys: reportIds[reportId],
    };

    json2csv(
        report,
        (err, csv) => {
            if (err) throw err;

            writeFile(filename, csv, (err2) => {
                if (err2) throw err2;
            });
        },
        options,
    );
};

/**
 * Generates report url for specific report Id.
 *
 * @param {Object} ctx       Koa request.
 * @param {String} url       Report url.
 * @param {String} reportId  Id of requested report.
 * @returns {String}         Complete url.
 */
const generateReportUrl = async (res, url, reportId) => {
    if (reportId === '312') {
        const { START_DATE_TIME, END_DATE_TIME } = parse(res.querystring);
        return `${url}?START_DATE_TIME=${START_DATE_TIME}&END_DATE_TIME=${END_DATE_TIME}`;
    }

    return url;
};

/**
 * Deletes reports file generated after been sent to client.
 *
 * @param {String} filename  Name of file to delete.
 * @returns {void}           Deletes the file.
 */
const deleteSavedReportFile = async (filename) => {
    access(filename, constants.F_OK, (e) => {
        if (!e) {
            unlink(filename, (err) => {
                if (err) throw err;
            });
        }
    });
};

module.exports = {
    generateReport,
    generateReportUrl,
    deleteSavedReportFile,
    generateReportFromResponse,
};
