const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getConnection, sql } = require('../database/database');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// JWT configuration - directly in this file to avoid import issues
const jwtConfig = {
  secret: process.env.JWT_SECRET_KEY,
  expiresIn: '24h' // Token expiration time
};

// Function to get Philippine time
function getPhilippineTime() {
  return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

// Create session function
async function createSession(userID) {
  try {
    const sessionID = uuidv4();
    const currentTime = new Date(getPhilippineTime());
    
    const pool = await getConnection();
    
    // First, check if there are any existing active sessions for this user
    const checkResult = await pool.request()
      .input('userID', sql.Int, userID)
      .query(`
        SELECT sessionID FROM sessions 
        WHERE userID = @userID 
        AND expires_at IS NULL
      `);
    
    // If there are existing active sessions, expire them
    if (checkResult.recordset.length > 0) {
      
      await pool.request()
        .input('userID', sql.Int, userID)
        .input('currentTime', sql.DateTime2, currentTime)
        .query(`
          UPDATE sessions 
          SET expires_at = @currentTime 
          WHERE userID = @userID 
          AND expires_at IS NULL
        `);
    }
    
    // Now create a new session with expires_at explicitly set to NULL
    await pool.request()
      .input('sessionID', sql.VarChar, sessionID)
      .input('userID', sql.Int, userID)
      .input('created_at', sql.DateTime2, currentTime)
      .query(`
        INSERT INTO sessions (sessionID, userID, created_at, expires_at)
        VALUES (@sessionID, @userID, @created_at, NULL)
      `);
    
    return sessionID;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

// Login function - modify to handle both direct calls and middleware usage
const login = async (reqOrUsername, res) => {
  try {
    let username, password, userID;
    
    // Check if this is being called directly with a username or as middleware
    if (typeof reqOrUsername === 'string') {
      // Direct call with username
      username = reqOrUsername;
      
      // Get user info from database
      const pool = await getConnection();
      const result = await pool.request()
        .input('username', sql.VarChar, username)
        .query('SELECT * FROM userInfo WHERE userName = @username');
      
      if (result.recordset.length === 0) {
        throw new Error(`User ${username} not found`);
      }
      
      userID = result.recordset[0].userID;
      
      // Create a session for the user
      const sessionID = await createSession(userID);
      return sessionID;
    } else {
      // Called as middleware with req, res
      const req = reqOrUsername;
      
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: 'Request body is missing'
        });
      }
      
      username = req.body.username;
      password = req.body.password;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }
      
      const pool = await getConnection();
      const result = await pool.request()
        .input('username', sql.VarChar, username)
        .query('SELECT * FROM userInfo WHERE userName = @username');
      
      if (result.recordset.length === 0) {
        console.log(`Login failed: User ${username} not found`);
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      
      const user = result.recordset[0];
      
      // In a real application, you would hash the password and compare
      if (password !== user.password) {
        console.log(`Login failed: Invalid password for user ${username}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      
      // Create a session for the user
      const sessionID = await createSession(user.userID);
      
      // Make sure jwtConfig.secret is not undefined
      const secretKey = jwtConfig.secret;
      
      // Generate JWT token with sessionID included
      const token = jwt.sign(
        { 
          userId: user.userID,
          username: user.userName,
          sessionID: sessionID  // Include sessionID in the token
        },
        secretKey,
        { expiresIn: jwtConfig.expiresIn }
      );
      
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          userId: user.userID,
          username: user.userName,
          fullName: user.fullName,
          position: user.position
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    if (typeof reqOrUsername !== 'string' && res) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred during login'
      });
    }
    throw error;
  }
};

// Logout function
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      
      if (!decoded.sessionID) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format - no sessionID'
        });
      }
      
      const pool = await getConnection();
      const currentTime = new Date(getPhilippineTime());
      
      // Update the session's expires_at to current time
      const result = await pool.request()
        .input('sessionID', sql.VarChar, decoded.sessionID)
        .input('currentTime', sql.DateTime2, currentTime)
        .query(`
          UPDATE sessions 
          SET expires_at = @currentTime 
          WHERE sessionID = @sessionID AND expires_at IS NULL
        `);
      
      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (jwtError) {
      console.error('JWT error during logout:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout'
    });
  }
};

// Validate token function
const validateToken = async (req, res) => {
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
      const decoded = jwt.verify(token, jwtConfig.secret);
      
      // Check if sessionID exists in the decoded token
      if (!decoded.sessionID) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format - no sessionID'
        });
      }
      
      // Check if the session exists in the database
      const pool = await getConnection();
      const result = await pool.request()
        .input('sessionID', sql.VarChar, decoded.sessionID)
        .query(`
          SELECT * FROM sessions 
          WHERE sessionID = @sessionID 
          AND expires_at IS NULL
        `);
      
      if (result.recordset.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or not found'
        });
      }
      
      return res.json({
        success: true,
        message: 'Token is valid',
        userId: decoded.userId
      });
    } catch (jwtError) {
      console.error('JWT validation error:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during token validation'
    });
  }
};

// Authentication middleware
const authMiddleware = async (req, res, next) => {
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
      const decoded = jwt.verify(token, jwtConfig.secret);
      
      // Check if sessionID exists in the decoded token
      if (!decoded.sessionID) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format - no sessionID'
        });
      }
      
      // Check if the session exists in the database
      const pool = await getConnection();
      const result = await pool.request()
        .input('sessionID', sql.VarChar, decoded.sessionID)
        .query(`
          SELECT s.*, u.* FROM sessions s
          JOIN userInfo u ON s.userID = u.userID
          WHERE s.sessionID = @sessionID 
          AND s.expires_at IS NULL
        `);
      
      if (result.recordset.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or not found'
        });
      }
      
      // Attach user info to request
      const user = result.recordset[0];
      req.user = {
        userId: user.userID,
        username: user.userName,
        fullName: user.fullName,
        position: user.position,
        sessionID: decoded.sessionID
      };

      next();
    } catch (jwtError) {
      console.error('JWT validation error in middleware:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication'
    });
  }
};

// Fix the getUserInfo function to properly return user data
const getUserInfo = async (req, res) => {
  try {
    // User info is attached to req by the authMiddleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    return res.json({
      success: true,
      userInfo: {
        userId: req.user.userId,
        username: req.user.username,
        fullName: req.user.fullName,
        position: req.user.position
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user info'
    });
  }
};

module.exports = {
  createSession,
  login,
  logout,
  validateToken,
  authMiddleware,
  getUserInfo
};