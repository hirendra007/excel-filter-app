// backend/routes/excelRoutes.js
const express = require('express');
const router = express.Router();
const excelController = require('../controllers/excelController');

router.get('/data', excelController.getAllData);
router.delete('/data', excelController.deleteAllData);

module.exports = router;
