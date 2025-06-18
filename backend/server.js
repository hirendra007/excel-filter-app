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

mongoose.connect('mongodb://Dheeraj:Dheeraj%40123@ac-qrutsty-shard-00-00.r3p61jm.mongodb.net:27017,ac-qrutsty-shard-00-01.r3p61jm.mongodb.net:27017,ac-qrutsty-shard-00-02.r3p61jm.mongodb.net:27017/?ssl=true&replicaSet=atlas-4cksr1-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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

