const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getConnection, sql } = require('../database/database');  // Update this line
const {authMiddleware} = require('../session/ssession');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    //File Directory
    const uploadDir = path.join('C:', 'Users', 'luisa', 'Documents', 'Projects', 'smartSK', 'projects');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter to only allow certain file types
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedFileTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, PPT, and PPTX files are allowed.'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Submit a new project
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    // Handle file upload with multer middleware
    upload.single('projectFile')(req, res, async function(err) {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Get form data
      const { title, description, userId } = req.body;
      
      if (!title || !description || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: title, description, and userId are required'
        });
      }
      
      // Generate reference number
      const referenceNumber = `PRJ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      
      try {
        // Get database connection
        const pool = await getConnection();
        
        // Store the full absolute path to the file
        const filePath = req.file ? 
          path.join('C:', 'Users', 'luisa', 'Documents', 'Projects', 'smartSK', 'projects', req.file.filename) : 
          null;
        
        // Parse userId as integer
        const userIdInt = parseInt(userId, 10);
        
        if (isNaN(userIdInt)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid userId format'
          });
        }
        
        // Create project record in database - updated for MSSQL
        const result = await pool.request()
          .input('referenceNumber', sql.VarChar, referenceNumber)
          .input('title', sql.VarChar, title)
          .input('description', sql.VarChar, description)
          .input('userID', sql.Int, userIdInt)
          .input('filePath', sql.VarChar, filePath)
          .input('fileName', sql.VarChar, req.file ? req.file.originalname : null)
          .query(`
            INSERT INTO projects (reference_number, title, description, userID, status, submittedDate, file_path, file_name) 
            VALUES (@referenceNumber, @title, @description, @userID, 'submitted', GETDATE(), @filePath, @fileName);
            SELECT SCOPE_IDENTITY() AS projectID;
          `);
        
        const projectId = result.recordset[0].projectID;
        
        // Fetch the newly created project
        const projectResult = await pool.request()
          .input('projectID', sql.Int, projectId)
          .query(`SELECT * FROM projects WHERE projectID = @projectID`);
        
        if (projectResult.recordset.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Project not found after creation'
          });
        }
        
        const project = {
          id: projectResult.recordset[0].projectID,
          referenceNumber: projectResult.recordset[0].reference_number,
          title: projectResult.recordset[0].title,
          description: projectResult.recordset[0].description,
          status: projectResult.recordset[0].status,
          submittedDate: projectResult.recordset[0].submittedDate,
          fileUrl: projectResult.recordset[0].file_path,
          fileName: projectResult.recordset[0].file_name
        };
        
        // Return success response
        return res.status(201).json({
          success: true,
          message: 'Project submitted successfully',
          project
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred while submitting the project: ' + dbError.message
        });
      }
    });
  } catch (error) {
    console.error('Error submitting project:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting the project: ' + error.message
    });
  }
});

// Get projects for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessionId = req.headers.authorization?.split(' ')[1];
    
    // Validate userId
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // If session is valid or we're skipping session check, get the user's projects
    // In the GET /user/:userId endpoint, make sure reviewedBy is included in the SELECT
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT projectID as id, reference_number as referenceNumber, title, description, 
               status, submittedDate, file_path as fileUrl, file_name as fileName,
               remarks, userID as userId, reviewedBy
        FROM projects
        WHERE userID = @userId
        ORDER BY submittedDate DESC
      `);
    
    return res.json({
      success: true,
      projects: result.recordset
    });
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

// Download a project file - simplified approach without authentication
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Construct the file path
    const filePath = path.join('C:', 'Users', 'luisa', 'Documents', 'Projects', 'smartSK', 'projects', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // Set appropriate content type based on file extension
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.doc' || ext === '.docx') contentType = 'application/msword';
    else if (ext === '.xls' || ext === '.xlsx') contentType = 'application/vnd.ms-excel';
    else if (ext === '.ppt' || ext === '.pptx') contentType = 'application/vnd.ms-powerpoint';
    
    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    
    // Send the file directly
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while serving the file'
    });
  }
});

// Get all projects (for admin) - updated for MSSQL
router.get('/all', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // Fetch all projects from database
    const result = await pool.request()
      .query(`
        SELECT p.*, u.userName as username 
        FROM projects p
        JOIN userInfo u ON p.userID = u.userID
        ORDER BY p.submittedDate DESC
      `);
    
    // Transform database results
    const formattedProjects = result.recordset.map(project => ({
      id: project.projectID,
      referenceNumber: project.reference_number,
      title: project.title,
      description: project.description,
      status: project.status,
      submittedDate: project.submittedDate,
      fileUrl: project.file_path,
      fileName: project.file_name,
      username: project.username,
      userId: project.userID,
      reviewedBy: project.reviewedBy || 'Unknown'
    }));
    
    return res.status(200).json({
      success: true,
      projects: formattedProjects
    });
  } catch (error) {
    console.error('Error fetching all projects:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching projects'
    });
  }
});

// Update project status - updated for MSSQL
router.put('/status/:projectId', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    const { projectId } = req.params;
    const { status, remarks, reviewerName } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // Update project status in database with reviewer name
    await pool.request()
      .input('status', sql.VarChar, status)
      .input('remarks', sql.VarChar, remarks || null)
      .input('reviewedBy', sql.NVarChar, reviewerName || req.user.fullName || 'Unknown')
      .input('projectID', sql.Int, projectId)
      .query(`UPDATE projects SET status = @status, remarks = @remarks, reviewedBy = @reviewedBy WHERE projectID = @projectID`);
    
    return res.status(200).json({
      success: true,
      message: 'Project status updated successfully'
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating project status'
    });
  }
});

module.exports = router;