const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../database/database');
const routeGuard = require('../routeGuard/routeGuard');

// Get all users with their roles
router.get('/users', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // First check if the userInfo table exists
    try {
      const tableCheck = await pool.request()
        .query(`
          SELECT OBJECT_ID('userInfo') AS TableExists
        `);
      
      if (!tableCheck.recordset[0].TableExists) {
        return res.status(500).json({
          success: false,
          message: 'userInfo table does not exist'
        });
      }
    } catch (tableError) {
      console.error('Error checking table existence:', tableError);
      return res.status(500).json({
        success: false,
        message: 'Error checking database tables'
      });
    }
    
    // Get all users from userInfo table
    const result = await pool.request()
      .query(`
        SELECT userID, userName, fullName, position, barangay, emailAddress, phoneNumber
        FROM userInfo
        ORDER BY fullName
      `);
    
    return res.json({
      success: true,
      users: result.recordset
    });
  } catch (error) {
    console.error('Error fetching users with roles:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users: ' + error.message
    });
  }
});

// Get all available roles
router.get('/all', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // First check if the roleInfo table exists
    try {
      const tableCheck = await pool.request()
        .query(`
          SELECT OBJECT_ID('roleInfo') AS TableExists
        `);
      
      if (!tableCheck.recordset[0].TableExists) {
        
        // Create the roleInfo table with the correct structure
        await pool.request().query(`
          CREATE TABLE roleInfo(
            roleID INT PRIMARY KEY IDENTITY(1,1),
            userID INT,
            position NVARCHAR(20) NOT NULL,
            FOREIGN KEY (userID) REFERENCES userInfo(userID)
          )
        `);
      }
    } catch (tableError) {
      console.error('Error checking or creating roleInfo table:', tableError);
      return res.status(500).json({
        success: false,
        message: 'Error checking or creating roleInfo table: ' + tableError.message
      });
    }
    
    // Query the roles with the correct columns
    const result = await pool.request()
      .query(`
        SELECT r.roleID, u.fullName AS roleName, r.position AS description
        FROM roleInfo r
        LEFT JOIN userInfo u ON r.userID = u.userID
        ORDER BY r.roleID
      `);
    
    return res.json({
      success: true,
      roles: result.recordset
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching roles: ' + error.message
    });
  }
});

// Get role permissions
router.get('/:roleId/permissions', async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query(`
        SELECT p.permissionID, p.permissionName, p.description
        FROM rolePermissions rp
        JOIN permissions p ON rp.permissionID = p.permissionID
        WHERE rp.roleID = @roleId
      `);
    
    return res.json({
      success: true,
      permissions: result.recordset
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching role permissions'
    });
  }
});

// Assign role to user
router.post('/assignRole', routeGuard.verifyToken, routeGuard.isAdmin, async (req, res) => {
  try {
    const { userId, position } = req.body;
    
    if (!userId || !position) {
      return res.status(400).json({
        success: false,
        message: 'User ID and position are required'
      });
    }
    
    const pool = await getConnection();
    
    // Update the user's position in userInfo table
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('position', sql.NVarChar, position)
      .query(`
        UPDATE userInfo 
        SET position = @position
        WHERE userID = @userId
      `);
    
    // Check if user already has a role in roleInfo
    const checkResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT roleID FROM roleInfo WHERE userID = @userId');
    
    if (checkResult.recordset.length > 0) {
      // Delete the existing role and create a new one instead of updating
      await pool.request()
        .input('userId', sql.Int, userId)
        .query('DELETE FROM roleInfo WHERE userID = @userId');
        
      // Insert new role assignment
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('position', sql.NVarChar, position)
        .query('INSERT INTO roleInfo (userID, position) VALUES (@userId, @position)');
    } else {
      // Insert new role assignment
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('position', sql.NVarChar, position)
        .query('INSERT INTO roleInfo (userID, position) VALUES (@userId, @position)');
    }
    
    return res.json({
      success: true,
      message: 'Role assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while assigning role: ' + error.message
    });
  }
});

// Create a new role
router.post('/create', async (req, res) => {
  try {
    const { userId, position } = req.body;
    
    if (!position) {
      return res.status(400).json({
        success: false,
        message: 'Position is required'
      });
    }
    
    const pool = await getConnection();
    
    // Begin transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Insert new role with correct table structure
      const roleResult = await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('position', sql.NVarChar, position)
        .query(`
          INSERT INTO roleInfo (userID, position)
          OUTPUT INSERTED.roleID
          VALUES (@userId, @position)
        `);
      
      const roleId = roleResult.recordset[0].roleID;
      
      // Commit transaction
      await transaction.commit();
      
      return res.status(201).json({
        success: true,
        message: 'Role created successfully',
        roleId
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error creating role:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating role'
    });
  }
});

// Delete a role
router.delete('/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const pool = await getConnection();
    
    // Begin transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Remove role permissions
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM rolePermissions WHERE roleID = @roleId');
      
      // Remove user role assignments
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM userRoles WHERE roleID = @roleId');
      
      // Delete the role with correct table name
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM roleInfo WHERE roleID = @roleId');
      
      // Commit transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting role:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting role'
    });
  }
});

module.exports = router;


// Add these routes to your roles.js file

// Get all users
router.get('/users', routeGuard.verifyToken, routeGuard.isAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT u.userID, u.userName, u.fullName, u.position, u.barangay, u.emailAddress, u.phoneNumber
        FROM userInfo u
        ORDER BY u.fullName
      `);
    
    return res.json({
      success: true,
      users: result.recordset
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users'
    });
  }
});

// Get all roles
router.get('/all', routeGuard.verifyToken, routeGuard.isAdmin, async (req, res) => {
  try {
    // Since we're using position abbreviations directly, we'll return a static list
    const roles = [
      { roleID: 1, roleName: 'Master Admin', abbreviation: 'MA', description: 'Full system access' },
      { roleID: 2, roleName: 'SK Reviewer', abbreviation: 'SKR', description: 'Can review and approve projects' },
      { roleID: 3, roleName: 'SK Officials', abbreviation: 'SKO', description: 'Can submit and manage projects' }
    ];
    
    return res.json({
      success: true,
      roles: roles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching roles'
    });
  }
});

// Assign or update role
router.post('/assignRole', routeGuard.verifyToken, routeGuard.isAdmin, async (req, res) => {
  try {
    const { userId, position } = req.body;
    
    if (!userId || !position) {
      return res.status(400).json({
        success: false,
        message: 'User ID and position are required'
      });
    }
    
    const pool = await getConnection();
    
    // Check if user exists
    const userCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT userID, position FROM userInfo WHERE userID = @userId');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get current position
    const currentPosition = userCheck.recordset[0].position;
    const isNewRole = !currentPosition || !['MA', 'SKR', 'SKO'].includes(currentPosition);
    
    // Update the position directly in userInfo table
    const updateResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('position', sql.NVarChar, position)
      .query(`
        UPDATE userInfo
        SET position = @position
        WHERE userID = @userId
      `);
    
    // Check if there's an entry in roleInfo table
    const roleCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT roleID FROM roleInfo WHERE userID = @userId');
    
    // If no role exists in roleInfo, create one
    if (roleCheck.recordset.length === 0) {
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('position', sql.NVarChar, position)
        .query('INSERT INTO roleInfo (userID, position) VALUES (@userId, @position)');
    } else {
      // Update existing role
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('position', sql.NVarChar, position)
        .input('roleId', sql.Int, roleCheck.recordset[0].roleID)
        .query('UPDATE roleInfo SET position = @position WHERE roleID = @roleId');
    }
    
    return res.json({
      success: true,
      message: isNewRole ? 'Role assigned successfully' : 'Role updated successfully'
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while assigning role: ' + error.message
    });
  }
});