const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exceldb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Excel Data Schema
const excelDataSchema = new mongoose.Schema({
  fileName: String,
  uploadDate: { type: Date, default: Date.now },
  data: [mongoose.Schema.Types.Mixed],
  headers: [String]
});

const ExcelData = mongoose.model('ExcelData', excelDataSchema);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Routes

// Upload Excel file
app.post('/api/upload', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Get headers
    const headers = Object.keys(jsonData[0]);

    // Save to MongoDB
    const excelDocument = new ExcelData({
      fileName: req.file.originalname,
      data: jsonData,
      headers: headers
    });

    await excelDocument.save();

    // Delete uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'File uploaded successfully',
      id: excelDocument._id,
      headers: headers,
      recordCount: jsonData.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Get all uploaded files
app.get('/api/files', async (req, res) => {
  try {
    const files = await ExcelData.find({}, { fileName: 1, uploadDate: 1, headers: 1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get filtered data
app.post('/api/filter/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { filters, page = 1, limit = 10 } = req.body;

    const excelDoc = await ExcelData.findById(id);
    if (!excelDoc) {
      return res.status(404).json({ error: 'File not found' });
    }

    let filteredData = excelDoc.data;

    // Apply filters
    if (filters && Object.keys(filters).length > 0) {
      filteredData = excelDoc.data.filter(row => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || value === '') return true;
          
          const rowValue = row[key];
          if (rowValue === null || rowValue === undefined) return false;
          
          // Handle different filter types
          if (typeof value === 'object') {
            if (value.type === 'range' && value.min !== undefined && value.max !== undefined) {
              const numValue = parseFloat(rowValue);
              return numValue >= value.min && numValue <= value.max;
            }
            if (value.type === 'contains') {
              return String(rowValue).toLowerCase().includes(String(value.value).toLowerCase());
            }
          }
          
          // Default exact match
          return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
        });
      });
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    res.json({
      data: paginatedData,
      totalRecords: filteredData.length,
      page: page,
      totalPages: Math.ceil(filteredData.length / limit),
      headers: excelDoc.headers
    });

  } catch (error) {
    console.error('Filter error:', error);
    res.status(500).json({ error: 'Failed to filter data' });
  }
});

// Get unique values for a column (for dropdown filters)
app.get('/api/unique-values/:id/:column', async (req, res) => {
  try {
    const { id, column } = req.params;
    const excelDoc = await ExcelData.findById(id);
    
    if (!excelDoc) {
      return res.status(404).json({ error: 'File not found' });
    }

    const uniqueValues = [...new Set(excelDoc.data.map(row => row[column]))];
    res.json(uniqueValues.filter(val => val !== null && val !== undefined));

  } catch (error) {
    res.status(500).json({ error: 'Failed to get unique values' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});