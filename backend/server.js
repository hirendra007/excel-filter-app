  // ✅ Load environment variables BEFORE anything else
  require('dotenv').config();

  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const multer = require('multer');
  const xlsx = require('xlsx');

  const ExcelData = require('./models/ExcelData');
  const excelRoutes = require('./routes/excelRoutes');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // ✅ Middlewares
  app.use(cors());
  app.use(express.json());

  // ✅ MongoDB Connection
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not defined in .env");
    process.exit(1); // stop execution
  }

  mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // exit if DB fails
  });

  // ✅ File Upload Setup using Multer
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // ✅ Excel Upload Route
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = xlsx.utils.sheet_to_json(sheet);

      await ExcelData.deleteMany(); // clear old entries
      await ExcelData.insertMany(jsonData); // save new entries

      res.json({ message: '✅ File uploaded and data saved!' });
    } catch (err) {
      console.error('❌ Upload error:', err);
      res.status(500).json({ error: 'Error uploading file' });
    }
  });

  // ✅ Other API Routes
  app.use('/api', excelRoutes);

  // ✅ Start Server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
