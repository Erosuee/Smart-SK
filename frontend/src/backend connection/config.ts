// API configuration for backend connections
const API_BASE_URL = import.meta.env.PROD 
  ? '/api' // In production, use relative path
  : window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : `http://${window.location.hostname}:3000/api`; // Use same hostname as frontend

console.log('Using API URL:', API_BASE_URL); // Add debugging

export default API_BASE_URL;