const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getConnection, sql } = require('../database/database');
const { login, logout, validateToken } = require('../session/ssession');

// Login route
router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    const pool = await getConnection();
    // Only select columns that exist in the userInfo table
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`
        SELECT userID, userName, passKey, fullName, position, barangay, 
               emailAddress, phoneNumber
        FROM userInfo 
        WHERE userName = @username
      `);
    
    if (result.recordset.length === 0) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    const user = result.recordset[0];
    
    // Remove the isApproved check since the column doesn't exist
    
    // Compare with passKey instead of password
    console.log('Comparing passwords...');
    const passwordMatches = await bcrypt.compare(password, user.passKey);
    
    if (!passwordMatches) {
      console.log(`Invalid password for user: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Create a session for the user
    const sessionID = await login(username);

    // In your login.js file, ensure the token includes the position
    const token = jwt.sign(
      { 
        userId: user.userID, 
        username: user.userName,
        sessionID: sessionID,
        position: user.position  // Make sure this is included
      },
      process.env.JWT_SECRET_KEY || 'your-secret-key-here',
      { expiresIn: '24h' }
    );
    
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.userID,
        username: user.userName,
        fullName: user.fullName,
        position: user.position,
        barangay: user.barangay
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
});

// Add validate-token route
router.get('/validate-token', async (req, res) => {
  await validateToken(req, res);
});

// Add logout route
router.post('/logout', async (req, res) => {
  await logout(req, res);
});

module.exports = router;