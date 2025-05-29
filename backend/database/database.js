const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Database configuration from environment variables
const dbConfig = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Validate configuration before creating connection
if (!dbConfig.server) {
  console.error('Database server configuration is missing. Check your .env file.');
  process.exit(1);
}

// Create a connection pool
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

// Handle connection errors
poolConnect.catch(err => {
  console.error('Database connection failed:', err);
});

// Export the pool for use in other modules
module.exports = {
  getConnection: async () => {
    try {
      await poolConnect;
      return pool;
    } catch (err) {
      console.error('Error getting database connection:', err);
      throw err;
    }
  },
  sql: sql
};