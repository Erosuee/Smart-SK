const express = require('express');
const router = express.Router();
const sql = require('mssql');
// Fix the database import path
const { getConnection } = require('../database/database');
// Import the email service
const { sendProjectStatusEmail } = require('../Email/email');

// Get all projects for review
router.get('/all', async (req, res) => {
  try {
    // Get database connection
    const pool = await getConnection();
    
    // First, let's verify the userInfo table structure and data
    const userCheck = await pool.request()
      .query(`SELECT TOP 5 userID, userName, fullName FROM userInfo`);
    
    // Query to get all projects with user information
    const result = await pool.request()
      .query(`
        SELECT p.projectID as id, p.reference_number as referenceNumber, p.title, p.description, 
               p.status, p.submittedDate, p.file_path as fileUrl, p.file_name as fileName,
               p.remarks, p.userID as userId, u.fullName as proposerName
        FROM projects p
        INNER JOIN userInfo u ON p.userID = u.userID
        ORDER BY p.submittedDate DESC
      `);
    
    return res.json({
      success: true,
      projects: result.recordset
    });
  } catch (error) {
    console.error('Error fetching projects for review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch projects for review',
      error: error.message
    });
  }
});

// Get a specific project by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get database connection
    const pool = await getConnection();
    
    // Query to get project details with user information - using fullName instead of userName
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT p.projectID as id, p.reference_number as referenceNumber, p.title, p.description, 
               p.status, p.submittedDate, p.file_path as fileUrl, p.file_name as fileName,
               p.remarks, p.userID as userId, u.fullName as username
        FROM projects p
        LEFT JOIN userInfo u ON p.userID = u.userID
        WHERE p.projectID = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    return res.json({
      success: true,
      project: result.recordset[0]
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch project details'
    });
  }
});

// Update project status and add review
router.put('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, reviewerName } = req.body;
    
    // Validate input
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Validate status value against the updated CHECK constraint
    if (!['submitted', 'revised', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be one of: submitted, revised, approved, denied'
      });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // First, get the project and user information for email notification
    const projectInfo = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT p.title, p.userID, u.emailAddress, u.fullName
        FROM projects p
        JOIN userInfo u ON p.userID = u.userID
        WHERE p.projectID = @id
      `);
    
    if (projectInfo.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if reviewedBy column exists in the projects table and fix it if needed
    try {
      // First, check if we can actually use the column by running a simple query
      const testQuery = await pool.request().query(`
        SELECT TOP 1 CASE WHEN EXISTS (
          SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'projects' AND COLUMN_NAME = 'reviewedBy'
        ) THEN 1 ELSE 0 END AS column_exists
      `);
      
      const columnExists = testQuery.recordset[0].column_exists === 1;
      
      if (!columnExists) {
        await pool.request().query(`
          ALTER TABLE projects 
          ADD reviewedBy NVARCHAR(50)
        `);
      } else {
        // Try to use the column to verify it's working
        try {
          await pool.request().query(`
            SELECT TOP 1 reviewedBy FROM projects
          `);
        } catch (accessError) {
          console.error('Column exists but is not accessible, recreating it:', accessError);
          
          // Drop and recreate the column
          await pool.request().query(`
            ALTER TABLE projects DROP COLUMN reviewedBy;
            ALTER TABLE projects ADD reviewedBy NVARCHAR(50);
          `);
        }
      }
    } catch (columnError) {
      console.error('Error checking/fixing reviewedBy column:', columnError);
    }
    
    try {
      // First update only the status and remarks (which we know exist)
      const updateBasicResult = await pool.request()
        .input('id', sql.Int, id)
        .input('status', sql.VarChar, status)
        .input('remarks', sql.Text, remarks || '')
        .query(`
          UPDATE projects
          SET status = @status, 
              remarks = @remarks
          WHERE projectID = @id;
        `);
      
      // Now try to update the reviewedBy column separately
      try {
        const updateReviewerResult = await pool.request()
          .input('id', sql.Int, id)
          .input('reviewedBy', sql.NVarChar(50), reviewerName || 'Unknown Reviewer')
          .query(`
            UPDATE projects
            SET reviewedBy = @reviewedBy
            WHERE projectID = @id;
          `);
      } catch (reviewerUpdateError) {
        console.error('Error updating reviewedBy column:', reviewerUpdateError);
        
        // If the column doesn't exist, try to add it again and then update
        if (reviewerUpdateError.message.includes("Invalid column name 'reviewedBy'")) {
          await pool.request().query(`
            ALTER TABLE projects 
            ADD reviewedBy NVARCHAR(50)
          `);
          
          // Try the update again
          await pool.request()
            .input('id', sql.Int, id)
            .input('reviewedBy', sql.NVarChar(50), reviewerName || 'Unknown Reviewer')
            .query(`
              UPDATE projects
              SET reviewedBy = @reviewedBy
              WHERE projectID = @id;
            `);
        }
      }
      
      // Get the updated project
      const updateResult = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT projectID as id, reference_number as referenceNumber, title, description, 
                 status, submittedDate, file_path as fileUrl, file_name as fileName,
                 remarks, userID as userId
          FROM projects 
          WHERE projectID = @id;
        `);
    
      if (updateResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Remove the project_reviews table creation and insertion code since it doesn't exist
      
      // Send email notification using the centralized email service
      const emailResult = await sendProjectStatusEmail(id, status, remarks);
      
      if (!emailResult.success) {
        console.warn(`Warning: Failed to send email notification for project ${id} status update`);
      } else {
      }
      
      return res.json({
        success: true,
        message: 'Project status updated successfully',
        project: updateResult.recordset[0]
      });
    } catch (error) {
      console.error('Error updating project status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update project status'
      });
    }
  } catch (error) {
    console.error('Error updating project status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update project status'
    });
  }
});

module.exports = router;