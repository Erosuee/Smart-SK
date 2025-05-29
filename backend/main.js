//Import the necessary modules
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { spawn } = require('child_process');
const os = require('os');
//Import the other js files
const routeGuard = require('./routeGuard/routeGuard');
const { getConnection, sql } = require('./database/database');
const loginRouter = require('./login/login');
const registerRouter = require('./register/register');
const forgotPasswordRoutes = require('./forgotpassword/forgotPassword');
const rolesRouter = require('./Admin/roles');
const projectSubmissionRouter = require('./projectlSubmission/projectSubmission');
const emailRouter = require('./Email/email').router;
const { login, logout, validateToken, authMiddleware } = require('./session/ssession');
const loginApproval = require('./Admin/loginApproval');
const projectReviewRouter = require('./projectReview/projectReview');
const PyBridge = require('./pyBridge/pyBridge');


// Load environment variables
dotenv.config();

// Initialize the Express app
const app = express();

// Configure CORS properly - add this before other middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - check each router before using it
if (loginRouter && typeof loginRouter === 'function') {
  app.use('/api/login', loginRouter);
}

if (registerRouter && typeof registerRouter === 'function') {
  app.use('/api/register', registerRouter);
}

if (forgotPasswordRoutes && typeof forgotPasswordRoutes === 'function') {
  app.use('/api/forgotpassword', forgotPasswordRoutes);
}

if (rolesRouter && typeof rolesRouter === 'function') {
  app.use('/api/roles', rolesRouter);
} else {
  console.error('rolesRouter is not a valid middleware function');
}

if (projectSubmissionRouter && typeof projectSubmissionRouter === 'function') {
  app.use('/api/projects', projectSubmissionRouter);
}

if (emailRouter && typeof emailRouter === 'function') {
  app.use('/api/email', emailRouter);
}

if (loginApproval && typeof loginApproval === 'function') {
  const loginApprovalRouter = require('./Admin/loginApproval');
  app.use('/api/loginapproval', loginApprovalRouter);
} else {
  console.error('loginApproval is not a valid middleware function');
}

if (projectReviewRouter && typeof projectReviewRouter === 'function') {
  app.use('/api/projectreview', projectReviewRouter);
}
else {
  console.error('projectReview is not a valid middleware function');
}

// Middleware that excludes certain paths
const protectRoutesExcept = (paths) => {
  return (req, res, next) => {
    // Skip authentication for specified paths
    if (paths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Apply authentication middleware for all other paths
    return authMiddleware(req, res, next);
  };
};

// Apply the middleware to all routes
app.use(protectRoutesExcept([
  '/api/login',
  '/api/register',
  '/api/forgotpassword',
  '/api/validate-token'
]));

// Add the session routes
app.post('/api/login', login);
app.post('/api/logout', logout);
app.get('/api/validate-token', validateToken);

// Add the admin check route
app.get('/api/check-admin', routeGuard.verifyToken, routeGuard.checkAdminStatus);

// Protect admin routes on the backend
app.use('/api/admin', routeGuard.verifyToken, routeGuard.isAdmin);

// Define the port
const PORT = process.env.PORT;

// Add or update the user-info endpoint
app.get('/api/user-info', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY || 'your-secret-key-here');
      
      // Get user info from database using userId from token
      const pool = await getConnection();
      const userResult = await pool.request()
        .input('userId', sql.Int, decoded.userId)
        .query(`
          SELECT userID, userName, fullName, position, barangay, emailAddress, phoneNumber 
          FROM userInfo 
          WHERE userID = @userId
        `);
      
      if (userResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      return res.json({
        success: true,
        userInfo: userResult.recordset[0]
      });
    } catch (jwtError) {
      console.error('JWT error during user info fetch:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user info'
    });
  }
});

// Add forecast API endpoint
app.get('/api/forecast', async (req, res) => {
  try {
    // Get any query parameters
    const options = req.query;
    
    // Run the forecast using PyBridge
    const forecastData = await PyBridge.runForecast(options);
    
    // Return the forecast data
    res.json(forecastData);
  } catch (error) {
    console.error('Error running forecast:', error);
    res.status(500).json({ 
      error: 'Failed to generate forecast',
      message: error.message
    });
  }
});

// Add forecast analysis API endpoint
app.get('/api/forecast-analysis', PyBridge.handleForecastAnalysisRequest);

// Add project trends API endpoint
app.get('/api/project-trends', PyBridge.handleProjectTrendsRequest);

// Add custom project trends API endpoint
app.get('/api/custom-project-trends', PyBridge.handleCustomProjectTrendsRequest);

// Add predictive analysis API endpoint
app.get('/api/predictive-analysis', async (req, res) => {
  try {
    // Get any query parameters
    const options = req.query;
    
    // Run the predictive analysis using PyBridge
    const analysisData = await PyBridge.runPredictiveAnalysis(options);
    
    // Return the analysis data
    res.json(analysisData);
  } catch (error) {
    console.error('Error running predictive analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate predictive analysis',
      message: error.message
    });
  }
});

app.post('/api/predictive-analysis', PyBridge.handlePredictiveAnalysisRequest);

// Add endpoint for customized predictive analysis
app.post('/api/customized-analysis', PyBridge.handleCustomizedAnalysisRequest);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use timestamp to ensure unique filenames
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    // Accept only certain file types
    const filetypes = /pdf|doc|docx|txt/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
  }
});

// Create a simple progress tracking mechanism
const analysisProgress = new Map();

// Add a new endpoint to check progress
app.get('/api/predictive-analysis/progress/:id', (req, res) => {
  const progressId = req.params.id;
  const progress = analysisProgress.get(progressId) || { status: 'unknown', progress: 0 };
  res.json(progress);
});

// Then update your upload endpoint
app.post('/api/predictive-analysis/upload', upload.single('file'), async (req, res) => {
  try {
    // Create a unique ID for this analysis request
    const analysisId = Date.now().toString();
    analysisProgress.set(analysisId, { status: 'starting', progress: 5 });
    
    // Send an immediate response with the analysis ID so the frontend can start polling
    res.json({
      analysis_id: analysisId,
      message: "Analysis started. Please check progress endpoint for updates.",
      analysis_type: 'specified'
    });
    
    // Get file content if available
    let fileContent = '';
    
    if (req.file) {
      const filePath = req.file.path;
      console.log("Uploaded file path:", filePath);
      analysisProgress.set(analysisId, { status: 'reading_file', progress: 10 });
      
      // Handle different file types
      const fileExtension = path.extname(filePath).toLowerCase();
      
      if (fileExtension === '.txt') {
        // For text files, read directly
        fileContent = fs.readFileSync(filePath, 'utf8');
        console.log("Text file content length:", fileContent.length);
      } 
      else if (fileExtension === '.pdf') {
        // For PDF files, use pdf-parse
        try {
          const dataBuffer = fs.readFileSync(filePath);
          analysisProgress.set(analysisId, { status: 'parsing_pdf', progress: 20 });
          const pdfData = await pdfParse(dataBuffer);
          fileContent = pdfData.text;
          console.log("PDF content extracted, length:", fileContent.length);
        } catch (pdfError) {
          console.error("Error parsing PDF:", pdfError);
          fileContent = `Error extracting content from PDF: ${req.file.originalname}`;
          analysisProgress.set(analysisId, { 
            status: 'error', 
            progress: 100,
            error: `Error extracting content from PDF: ${pdfError.message}`
          });
          return;
        }
      } 
      else if (['.doc', '.docx'].includes(fileExtension)) {
        // For Word documents, we'd need another library
        // For now, just note that it's a Word document
        fileContent = `This is a Word document (${req.file.originalname}). Content extraction not implemented yet.`;
      } 
      else {
        // For other file types
        fileContent = `File uploaded: ${req.file.originalname} (Content extraction not supported for this file type)`;
      }
    } else {
      console.log("No file received in the request");
      analysisProgress.set(analysisId, { 
        status: 'error', 
        progress: 100,
        error: 'No file uploaded'
      });
      return;
    }
    
    analysisProgress.set(analysisId, { status: 'preparing_analysis', progress: 30 });
    
    // Get analysis options from request body
    const options = {
      analysis_type: 'specified', // Force specified type for file uploads
      category: req.body.category || 'None',
      time_period: req.body.time_period || 'None',
      include_budget: req.body.include_budget === 'true',
      include_duration: req.body.include_duration === 'true',
      include_implement_date: req.body.include_implement_date === 'true',
      include_recommendations: req.body.include_recommendations === 'true',
      include_risks: req.body.include_risks === 'true',
      include_trends: req.body.include_trends === 'true',
      include_success_factors: req.body.include_success_factors === 'true',
      include_feedback: req.body.include_feedback === 'true',
      file_content: fileContent, // Add the file content directly to options
      analysis_id: analysisId // Pass the analysis ID to Python
    };
    
    console.log("Sending options to Python with file content length:", fileContent.length);
    analysisProgress.set(analysisId, { status: 'sending_to_ai', progress: 40 });
    
    // Call Python script with options
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [
      path.join(__dirname, 'AI', 'pa.py'),
      JSON.stringify(options)
    ]);
    
    let result = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      
      // Check if this is a progress update
      if (dataStr.startsWith('PROGRESS:')) {
        try {
          const progressData = JSON.parse(dataStr.substring(9));
          analysisProgress.set(analysisId, progressData);
        } catch (e) {
          console.error("Error parsing progress data:", e);
        }
      } else {
        result += dataStr;
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      // Clean up the uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      if (code !== 0) {
        analysisProgress.set(analysisId, { 
          status: 'error', 
          progress: 100,
          error: 'Failed to run analysis'
        });
        return;
      }
      
      try {
        const analysisResult = JSON.parse(result);
        analysisProgress.set(analysisId, { 
          status: 'completed', 
          progress: 100,
          result: analysisResult
        });
      } catch (e) {
        console.error("Error parsing JSON result:", e);
        analysisProgress.set(analysisId, { 
          status: 'completed', 
          progress: 100,
          result: { 
            rawOutput: result,
            message: 'Failed to parse JSON result from Python script',
            analysis_id: analysisId
          }
        });
      }
      
      // Clean up progress after 30 minutes
      setTimeout(() => {
        analysisProgress.delete(analysisId);
      }, 30 * 60 * 1000);
    });
  } catch (error) {
    console.error('Error in predictive analysis:', error);
    if (analysisId) {
      analysisProgress.set(analysisId, { 
        status: 'error', 
        progress: 100,
        error: error.message
      });
    }
  }
});

// Update your existing predictive analysis endpoint to handle customization options
app.post('/api/predictive-analysis/custom', async (req, res) => {
  try {
    // Get analysis options from request body
    const options = {
      analysis_type: req.body.analysis_type || 'general',
      category: req.body.category || 'None',
      time_period: req.body.time_period || 'None',
      include_budget: req.body.include_budget,
      include_duration: req.body.include_duration,
      include_implement_date: req.body.include_implement_date,
      include_recommendations: req.body.include_recommendations,
      include_risks: req.body.include_risks,
      include_trends: req.body.include_trends,
      include_success_factors: req.body.include_success_factors,
      include_feedback: req.body.include_feedback
    };
    
    // Call Python script with options
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [
      path.join(__dirname, 'AI', 'pa.py'),
      JSON.stringify(options)
    ]);
    
    let result = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to run analysis' });
      }
      
      try {
        const analysisResult = JSON.parse(result);
        res.json(analysisResult);
      } catch (e) {
        res.json({ 
          rawOutput: result,
          message: 'Failed to parse JSON result from Python script'
        });
      }
    });
  } catch (error) {
    console.error('Error in predictive analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Determine the correct Python executable based on the OS
const getPythonExecutable = () => {
  const platform = os.platform();
  // On Windows, typically just 'python' is used
  if (platform === 'win32') {
    return 'python';
  }
  // On macOS and Linux, try 'python3' first
  return 'python3';
};

// Python executable name
const PYTHON_EXECUTABLE = getPythonExecutable();

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running successfully! Access the API at http://localhost:${PORT}`);
});
