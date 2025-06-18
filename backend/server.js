// backend/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelData = require('./models/ExcelData');
const excelRoutes = require('./routes/excelRoutes');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/exceldb')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// File Upload Setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    await ExcelData.deleteMany(); // Optional: clear existing
    await ExcelData.insertMany(jsonData);

    res.json({ message: 'File uploaded and data saved!' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

// API Routes
app.use('/api', excelRoutes);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
