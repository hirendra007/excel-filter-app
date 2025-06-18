require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_filter_db';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:4200'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(`/${UPLOAD_DIR}`, express.static(UPLOAD_DIR));

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// MongoDB Connection with better error handling
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`📦 Database: ${mongoose.connection.name}`);
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
});

// Dynamic Schema for Excel data
const createDynamicSchema = (sampleData) => {
    const schemaFields = {};
    
    if (sampleData && sampleData.length > 0) {
        Object.keys(sampleData[0]).forEach(key => {
            schemaFields[key] = { 
                type: mongoose.Schema.Types.Mixed,
                index: true // Add index for better query performance
            };
        });
    }
    
    return new mongoose.Schema(schemaFields, { 
        timestamps: true,
        strict: false, // Allow additional fields not defined in schema
        collection: 'excel_data' // Explicit collection name
    });
};

// Storage for current Excel model
let ExcelData = null;
let currentColumns = [];
let modelInitialized = false;

// Initialize default model if needed
const initializeDefaultModel = () => {
    if (!modelInitialized) {
        const defaultSchema = new mongoose.Schema({}, { 
            timestamps: true,
            strict: false,
            collection: 'excel_data'
        });
        
        try {
            ExcelData = mongoose.model('ExcelData');
        } catch (error) {
            ExcelData = mongoose.model('ExcelData', defaultSchema);
        }
        modelInitialized = true;
    }
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `excel-${uniqueSuffix}${fileExtension}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/octet-stream' // Sometimes Excel files are detected as this
    ];
    
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only Excel files (.xlsx, .xls) are allowed. Received: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }
});

// Helper function to clean column names
const cleanColumnName = (name) => {
    if (!name) return 'unnamed_column';
    
    return name.toString()
        .trim()
        .replace(/[^\w\s]/gi, '_') // Replace special characters with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .toLowerCase() // Convert to lowercase for consistency
        || 'unnamed_column'; // Fallback if string becomes empty
};

// Helper function to process Excel data
const processExcelData = (filePath) => {
    try {
        console.log(`📊 Processing Excel file: ${filePath}`);
        
        const workbook = XLSX.readFile(filePath, {
            cellDates: true,
            cellNF: false,
            cellText: false
        });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with better options
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
            raw: false // This ensures dates and numbers are converted to strings
        });
        
        if (jsonData.length === 0) {
            throw new Error('Excel file is empty');
        }
        
        if (jsonData.length === 1) {
            throw new Error('Excel file contains only headers, no data rows found');
        }
        
        // Get headers from first row and clean them
        const rawHeaders = jsonData[0];
        const headers = rawHeaders.map((header, index) => {
            const cleaned = cleanColumnName(header);
            return cleaned || `column_${index + 1}`;
        });
        
        // Check for duplicate headers and make them unique
        const uniqueHeaders = [];
        const headerCounts = {};
        
        headers.forEach(header => {
            if (headerCounts[header]) {
                headerCounts[header]++;
                uniqueHeaders.push(`${header}_${headerCounts[header]}`);
            } else {
                headerCounts[header] = 1;
                uniqueHeaders.push(header);
            }
        });
        
        const dataRows = jsonData.slice(1);
        
        // Convert to objects with cleaned headers
        const processedData = dataRows
            .filter(row => {
                // Filter out completely empty rows
                return row.some(cell => 
                    cell !== '' && 
                    cell !== null && 
                    cell !== undefined && 
                    String(cell).trim() !== ''
                );
            })
            .map((row, rowIndex) => {
                const obj = {};
                uniqueHeaders.forEach((header, index) => {
                    let cellValue = row[index];
                    
                    // Handle different data types
                    if (cellValue === null || cellValue === undefined) {
                        obj[header] = '';
                    } else if (typeof cellValue === 'object' && cellValue instanceof Date) {
                        obj[header] = cellValue.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
                    } else {
                        obj[header] = String(cellValue).trim();
                    }
                });
                return obj;
            });
        
        console.log(`✅ Processed ${processedData.length} records with ${uniqueHeaders.length} columns`);
        
        return {
            data: processedData,
            columns: uniqueHeaders
        };
    } catch (error) {
        console.error('❌ Excel processing error:', error);
        throw new Error(`Error processing Excel file: ${error.message}`);
    }
};

// Helper function to build MongoDB filter query
const buildFilterQuery = (filters) => {
    const query = {};
    
    if (!filters || typeof filters !== 'object') {
        return query;
    }
    
    Object.keys(filters).forEach(column => {
        const filter = filters[column];
        
        if (!filter || typeof filter !== 'object') {
            return;
        }
        
        const { type, value, operator } = filter;
        
        switch (type) {
            case 'text':
                if (value && value.trim()) {
                    switch (operator) {
                        case 'equals':
                            query[column] = { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') };
                            break;
                        case 'contains':
                            query[column] = { $regex: new RegExp(escapeRegex(value), 'i') };
                            break;
                        case 'startsWith':
                            query[column] = { $regex: new RegExp(`^${escapeRegex(value)}`, 'i') };
                            break;
                        case 'endsWith':
                            query[column] = { $regex: new RegExp(`${escapeRegex(value)}$`, 'i') };
                            break;
                        case 'notEquals':
                            query[column] = { $not: { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') } };
                            break;
                        default:
                            query[column] = { $regex: new RegExp(escapeRegex(value), 'i') };
                    }
                }
                break;
                
            case 'number':
                if (value !== null && value !== undefined && value !== '') {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        switch (operator) {
                            case 'equals':
                                query[column] = numValue;
                                break;
                            case 'greater':
                                query[column] = { $gt: numValue };
                                break;
                            case 'less':
                                query[column] = { $lt: numValue };
                                break;
                            case 'greaterEqual':
                                query[column] = { $gte: numValue };
                                break;
                            case 'lessEqual':
                                query[column] = { $lte: numValue };
                                break;
                            case 'notEquals':
                                query[column] = { $ne: numValue };
                                break;
                        }
                    }
                }
                break;
                
            case 'date':
                if (value && value.trim()) {
                    const dateValue = new Date(value);
                    if (!isNaN(dateValue.getTime())) {
                        const dateStr = dateValue.toISOString().split('T')[0];
                        switch (operator) {
                            case 'equals':
                                query[column] = dateStr;
                                break;
                            case 'after':
                                query[column] = { $gt: dateStr };
                                break;
                            case 'before':
                                query[column] = { $lt: dateStr };
                                break;
                            case 'onOrAfter':
                                query[column] = { $gte: dateStr };
                                break;
                            case 'onOrBefore':
                                query[column] = { $lte: dateStr };
                                break;
                        }
                    }
                }
                break;
                
            case 'boolean':
                if (value === 'true' || value === 'false') {
                    query[column] = value === 'true';
                }
                break;
                
            case 'select':
                if (Array.isArray(value) && value.length > 0) {
                    query[column] = { $in: value };
                } else if (value && typeof value === 'string') {
                    query[column] = value;
                }
                break;
        }
    });
    
    return query;
};

// Helper function to escape regex special characters
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        uptime: process.uptime()
    });
});

// Upload Excel file
app.post('/api/upload', upload.single('file'), async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        filePath = req.file.path;
        console.log(`📁 File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
        
        const { data, columns } = processExcelData(filePath);
        
        if (data.length === 0) {
            return res.status(400).json({ message: 'No valid data found in Excel file' });
        }
        
        // Clear existing data if model exists
        if (ExcelData) {
            const deleteResult = await ExcelData.deleteMany({});
            console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing records`);
        }
        
        // Create new model with dynamic schema
        const dynamicSchema = createDynamicSchema(data);
        
        // Remove existing model if it exists
        if (mongoose.models.ExcelData) {
            delete mongoose.models.ExcelData;
        }
        
        ExcelData = mongoose.model('ExcelData', dynamicSchema);
        currentColumns = columns;
        modelInitialized = true;
        
        // Insert new data in batches for better performance
        const batchSize = 1000;
        let insertedCount = 0;
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await ExcelData.insertMany(batch, { ordered: false });
            insertedCount += batch.length;
            console.log(`📝 Inserted batch: ${insertedCount}/${data.length} records`);
        }
        
        console.log(`✅ Successfully imported ${insertedCount} records`);
        
        res.json({
            message: 'File uploaded and processed successfully',
            recordCount: insertedCount,
            columns: columns,
            fileName: req.file.originalname
        });
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        
        res.status(500).json({ 
            message: error.message || 'Error processing file',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        // Clean up uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🧹 Cleaned up temporary file: ${filePath}`);
            } catch (cleanupError) {
                console.error('⚠️ Error cleaning up file:', cleanupError);
            }
        }
    }
});

// Get all Excel data with pagination
app.get('/api/data', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.json([]);
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000; // Default limit
        const skip = (page - 1) * limit;
        
        const data = await ExcelData.find({})
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();
            
        const total = await ExcelData.countDocuments();
        
        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Get data error:', error);
        res.status(500).json({ message: 'Error fetching data' });
    }
});

// Get columns
app.get('/api/columns', async (req, res) => {
    try {
        res.json(currentColumns);
    } catch (error) {
        console.error('❌ Get columns error:', error);
        res.status(500).json({ message: 'Error fetching columns' });
    }
});

// Advanced filter data with multiple options
app.post('/api/filter', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.json({
                data: [],
                pagination: {
                    page: 1,
                    limit: 1000,
                    total: 0,
                    pages: 0
                }
            });
        }
        
        const { filters, page = 1, limit = 1000, sort } = req.body;
        const skip = (page - 1) * limit;
        
        // Build filter query
        const filterQuery = buildFilterQuery(filters);
        
        console.log('🔍 Filter query:', JSON.stringify(filterQuery, null, 2));
        
        // Build sort options
        let sortOptions = {};
        if (sort && sort.column && sort.direction) {
            sortOptions[sort.column] = sort.direction === 'desc' ? -1 : 1;
        } else {
            sortOptions = { createdAt: -1 }; // Default sort by creation time
        }
        
        // Execute query with filters
        const data = await ExcelData.find(filterQuery)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();
            
        const total = await ExcelData.countDocuments(filterQuery);
        
        console.log(`✅ Filter results: ${data.length} records (${total} total matching)`);
        
        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            filters: filterQuery
        });
        
    } catch (error) {
        console.error('❌ Filter error:', error);
        res.status(500).json({ 
            message: 'Error filtering data',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get unique values for a column (for dropdown filters)
app.get('/api/column/:columnName/values', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.json([]);
        }
        
        const { columnName } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        if (!currentColumns.includes(columnName)) {
            return res.status(400).json({ message: 'Column not found' });
        }
        
        const values = await ExcelData.distinct(columnName);
        
        // Filter out empty values and limit results
        const filteredValues = values
            .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
            .slice(0, limit)
            .sort();
        
        res.json(filteredValues);
        
    } catch (error) {
        console.error('❌ Get column values error:', error);
        res.status(500).json({ message: 'Error fetching column values' });
    }
});

// Export filtered data to Excel
app.post('/api/export', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.status(400).json({ message: 'No data available to export' });
        }
        
        const { filters, format = 'xlsx' } = req.body;
        
        // Build filter query
        const filterQuery = buildFilterQuery(filters);
        
        // Get all matching data (no pagination for export)
        const data = await ExcelData.find(filterQuery)
            .lean()
            .exec();
        
        if (data.length === 0) {
            return res.status(400).json({ message: 'No data matches the current filters' });
        }
        
        // Remove MongoDB-specific fields
        const cleanData = data.map(item => {
            const { _id, __v, createdAt, updatedAt, ...cleanItem } = item;
            return cleanItem;
        });
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(cleanData);
        
        // Auto-size columns
        const columnWidths = [];
        if (cleanData.length > 0) {
            Object.keys(cleanData[0]).forEach(key => {
                const maxLength = Math.max(
                    key.length,
                    ...cleanData.map(row => String(row[key] || '').length)
                );
                columnWidths.push({ wch: Math.min(maxLength + 2, 50) });
            });
            worksheet['!cols'] = columnWidths;
        }
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Data');
        
        // Generate file
        const fileName = `filtered_data_${Date.now()}.${format}`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        
        XLSX.writeFile(workbook, filePath);
        
        console.log(`📊 Exported ${cleanData.length} records to ${fileName}`);
        
        // Send file
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('❌ Export download error:', err);
            }
            
            // Clean up file after download
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🧹 Cleaned up export file: ${fileName}`);
                }
            }, 60000); // Delete after 1 minute
        });
        
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({ 
            message: 'Error exporting data',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.json({
                totalRecords: 0,
                columns: [],
                lastUpdated: null
            });
        }
        
        const totalRecords = await ExcelData.countDocuments();
        const latestRecord = await ExcelData.findOne({}, {}, { sort: { createdAt: -1 } });
        
        res.json({
            totalRecords,
            columns: currentColumns,
            lastUpdated: latestRecord ? latestRecord.createdAt : null,
            databaseName: mongoose.connection.name
        });
        
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ message: 'Error fetching statistics' });
    }
});

// Clear all data
app.delete('/api/data', async (req, res) => {
    try {
        initializeDefaultModel();
        
        if (!ExcelData) {
            return res.json({ message: 'No data to clear', deletedCount: 0 });
        }
        
        const result = await ExcelData.deleteMany({});
        currentColumns = [];
        
        console.log(`🗑️ Cleared ${result.deletedCount} records`);
        
        res.json({
            message: 'All data cleared successfully',
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error('❌ Clear data error:', error);
        res.status(500).json({ message: 'Error clearing data' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
            });
        }
        return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
});

// 404 handler - Fixed the problematic wildcard route
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Upload directory: ${UPLOAD_DIR}`);
    console.log(`📁 Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;