// backend/models/ExcelData.js
const mongoose = require('mongoose');

const excelDataSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

module.exports = mongoose.model('ExcelData', excelDataSchema);
