// TODO: Remove previous line and work through linting issues at next edit

const { writeFile, unlink } = require('fs');
const { parse } = require('qs');

/**
 * Generates a csv format of report and saves it.
 *
 * @param {Object} report    Reports from jasperserver.
 * @param {String} filename  Name of file to save.
 * @returns {void}           Creates and saves file.
 */
const generateReport = async (report, filename) => {
    writeFile(filename, report, (err2) => {
        if (err2) throw err2;
    });
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
    unlink(filename, (err) => {
        if (err) throw err;
    });
};

module.exports = { generateReport, generateReportUrl, deleteSavedReportFile };
