const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../database/database');
const bcrypt = require('bcrypt');

// Remove any routeGuard middleware from this route
router.post('/', async (req, res) => {
  try {
    const { username, password, fullName, position, barangay, emailAddress, phoneNumber } = req.body;
    
    // Validate required fields
    if (!username || !password || !fullName || !position || !barangay || !emailAddress || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    const pool = await getConnection();
    
    // Check for duplicate username, email, and phone number
    const duplicateCheckResult = await pool.request()
      .input('username', sql.NVarChar(20), username)
      .input('email', sql.NVarChar(50), emailAddress)
      .input('phone', sql.VarChar(11), phoneNumber)
      .query(`
        SELECT 'username' as field FROM userInfo WHERE userName = @username
        UNION
        SELECT 'username' as field FROM pendingInfo WHERE userName = @username
        UNION
        SELECT 'email' as field FROM userInfo WHERE emailAddress = @email
        UNION
        SELECT 'email' as field FROM pendingInfo WHERE emailAddress = @email
        UNION
        SELECT 'phone' as field FROM userInfo WHERE phoneNumber = @phone
        UNION
        SELECT 'phone' as field FROM pendingInfo WHERE phoneNumber = @phone
      `);
    
    if (duplicateCheckResult.recordset.length > 0) {
      const duplicateField = duplicateCheckResult.recordset[0].field;
      let errorMessage = '';
      
      switch (duplicateField) {
        case 'username':
          errorMessage = 'Username already exists. Please choose another.';
          break;
        case 'email':
          errorMessage = 'Email address already registered.';
          break;
        case 'phone':
          errorMessage = 'Phone number already registered.';
          break;
        default:
          errorMessage = 'Registration failed due to duplicate information.';
      }
      
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }
    
    // Hash the password with bcrypt using salt rounds of 10
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user into pendingInfo table with hashed password
    await pool.request()
      .input('username', sql.NVarChar(20), username)
      .input('password', sql.NVarChar(255), hashedPassword)
      .input('fullName', sql.NVarChar(50), fullName)
      .input('position', sql.NVarChar(20), position)
      .input('barangay', sql.NVarChar(20), barangay)
      .input('emailAddress', sql.NVarChar(50), emailAddress)
      .input('phoneNumber', sql.VarChar(11), phoneNumber)
      .query(`
        INSERT INTO pendingInfo (userName, passKey, fullName, position, barangay, emailAddress, phoneNumber)
        VALUES (@username, @password, @fullName, @position, @barangay, @emailAddress, @phoneNumber)
      `);
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending approval.'
    });
  } catch (error) {
    console.error('Error in registration process:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again later.'
    });
  }
});

// Add a new endpoint to check username availability
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username parameter is required'
      });
    }
    
    const pool = await getConnection();
    
    // Check if username exists in either table
    const usernameCheckResult = await pool.request()
      .input('username', sql.NVarChar(20), username)
      .query(`
        SELECT userName FROM userInfo WHERE userName = @username
        UNION
        SELECT userName FROM pendingInfo WHERE userName = @username
      `);
    
    return res.json({
      success: true,
      available: usernameCheckResult.recordset.length === 0
    });
  } catch (error) {
    console.error('Username check error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while checking username availability'
    });
  }
});

module.exports = router;