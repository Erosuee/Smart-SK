const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../database/database');
const routeGuard = require('../routeGuard/routeGuard');
const { sendAccountApprovalEmail, sendAccountRejectionEmail } = require('../Email/email');

// Apply middleware to verify token for all routes in this router
router.use(routeGuard.verifyToken);

// Get all pending login approvals
router.get('/pending', routeGuard.isAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT p.userID, p.userName, p.fullName, p.position, p.barangay, p.emailAddress, p.phoneNumber
        FROM pendingInfo p
      `);
    
    return res.json({
      success: true,
      pendingApprovals: result.recordset
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching pending approvals'
    });
  }
});

// Approve a user login
router.post('/approve/:userId', routeGuard.isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await getConnection();
    
    // First, get the user details for the email
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT * FROM pendingInfo
        WHERE userID = @userId
      `);
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.recordset[0];
    
    // Send approval email
    const emailResult = await sendAccountApprovalEmail(userId);
    
    if (!emailResult.success) {
      console.error('Failed to send approval email:', emailResult.error);
      // Continue with the process even if email fails
    }
    
    // Call the stored procedure to transfer data
    // Change parameter name from 'userId' to 'PendingUserID' to match the stored procedure
    const transferResult = await pool.request()
      .input('PendingUserID', sql.Int, userId)
      .execute('transferInfo');
    
    return res.json({
      success: true,
      message: 'User approved successfully'
    });
  } catch (error) {
    console.error('Error approving user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while approving the user'
    });
  }
});

// Reject a user login
router.post('/reject/:userId', routeGuard.isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // Optional rejection reason
    
    const pool = await getConnection();
    
    // First, get the user details for the email
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT * FROM pendingInfo
        WHERE userID = @userId
      `);
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.recordset[0];
    
    // Send rejection email
    const emailResult = await sendAccountRejectionEmail(
      user.emailAddress,
      user.fullName,
      reason || 'Your application did not meet our requirements.'
    );
    
    if (!emailResult.success) {
      console.error('Failed to send rejection email:', emailResult.error);
      // Continue with the process even if email fails
    }
    
    // Delete the user from pendingInfo
    const deleteResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        DELETE FROM pendingInfo
        WHERE userID = @userId
      `);
    
    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      message: 'User rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while rejecting the user'
    });
  }
});

// Make sure to export the router
module.exports = router;