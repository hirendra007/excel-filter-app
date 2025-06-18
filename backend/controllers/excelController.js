// backend/controllers/excelController.js
const ExcelData = require('../models/ExcelData');

exports.getAllData = async (req, res) => {
  try {
    const data = await ExcelData.find();
    res.json({ data }); // ✅ wrapped in { data: [...] } for frontend compatibility
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAllData = async (req, res) => {
  try {
    await ExcelData.deleteMany();
    res.json({ message: 'All data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
