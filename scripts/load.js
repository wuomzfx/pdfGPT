const config = require('../config');
const { loadingPdf } = require('../index');
const { getPdfPath } = require('../utils/fs');

const { pdfName } = config;

const pdfPath = getPdfPath(pdfName);

loadingPdf(pdfPath);
