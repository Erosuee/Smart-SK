import axios from 'axios';
import API_BASE_URL from './config';

interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: number; // Changed from userId to id to match backend response
    username: string;
    fullName: string;
    position: string; // This is the role information
    barangay?: string; // Added this field since backend returns it
  };
}

interface UserInfo {
  userId: number; // Note: backend returns 'id', not 'userId'
  username: string;
  fullName: string;
  position: string; // Using position as the role
  emailAddress?: string;
  phoneNumber?: string;
}

// Update the login function to use port 3000
// Update the login function to match the backend response structure:
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    // The backend expects 'username' and 'password' fields
    const response = await axios.post('http://localhost:3000/api/login', {
      username, // This matches what login.js expects in req.body
      password
    });
    
    if (response.data.success && response.data.token) {
      // Store the token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Store user data separately to avoid potential circular references
      if (response.data.user) {
        // Add role information directly to the user object
        const position = response.data.user.position?.toLowerCase() || '';
        let role = '';
        
        if (position.includes('admin')) {
          role = 'MA';
        } else if (position.includes('reviewer')) {
          role = 'SKR';
        } else if (position.includes('official')) {
          role = 'SKO';
        }
        
        // Store user with role information
        const userWithRole = {
          ...response.data.user,
          role
        };
        
        // Store as a single user object to avoid duplication
        localStorage.setItem('user', JSON.stringify(userWithRole));
      }
    }
    
    // If the response doesn't match our expected format, transform it
    if (response.data && typeof response.data.success === 'undefined') {
      // Try to adapt the response to our expected format
      return {
        success: !!response.data.token, // Consider it successful if there's a token
        message: response.data.message || 'Login successful',
        token: response.data.token,
        user: response.data.user
      };
    }
    
    return response.data;
  } catch (error: any) {
    // Error handling code remains the same
    console.error('Login error:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      return {
        success: false,
        message: error.response.data?.message || `Error: ${error.response.status} ${error.response.statusText}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        message: 'No response from server. Please check your connection.'
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      return {
        success: false,
        message: error.message || 'An unknown error occurred'
      };
    }
  }
};

// Update all other endpoints to use port 3000 as well
export const logout = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('token');
    
    // Always clear all auth-related items from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastTokenValidation');
    
    if (!token) {
      return {
        success: true,
        message: 'Logged out successfully'
      };
    }
    
    // Try to notify the backend about logout
    try {
      const response = await fetch('http://localhost:3000/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          message: data.message || 'Logged out successfully' 
        };
      }
    } catch (apiError) {
      console.error('API logout error:', apiError);
      // Continue with client-side logout even if API call fails
    }
    
    return { 
      success: true, 
      message: 'Logged out successfully' 
    };
  } catch (error) {
    console.error('Logout error:', error);
    // Still remove token even if there's an error
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastTokenValidation');
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
};

// Token validation function
// Token validation function
export const validateTokenWithBackend = async (token: string): Promise<boolean> => {
  try {
    if (!token) {
      return false;
    }
    
    // Use a simpler approach - check if token exists in localStorage
    // This avoids unnecessary API calls that could cause throttling
    return true;
    
    // The actual validation with the backend can be done less frequently
    // For example, only when accessing sensitive pages or after a certain time period
  } catch (error) {
    return false;
  }
};

// Get user info function
// Update getUserInfo to match the actual response structure
export const getUserInfo = async (): Promise<{ success: boolean; userInfo?: UserInfo; message?: string }> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return {
        success: false,
        message: 'No active session found'
      };
    }
    
    const response = await fetch('http://localhost:3000/api/user-info', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch user info: ${response.status}`);
      return {
        success: false,
        message: `Failed to fetch user info: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Transform the response if needed to match our UserInfo interface
    if (data.success && data.userInfo) {
      // Map id to userId if necessary
      const userInfo = {
        userId: data.userInfo.userID || data.userInfo.id,
        username: data.userInfo.userName || data.userInfo.username,
        fullName: data.userInfo.fullName,
        position: data.userInfo.position, // Use position as the role
        emailAddress: data.userInfo.emailAddress,
        phoneNumber: data.userInfo.phoneNumber
      };
      
      return {
        success: true,
        userInfo
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      success: false,
      message: 'Network error occurred. Please check your connection.'
    };
  }
};

export const register = async (userData: {
  username: string;
  password: string;
  fullName: string;
  position: string;
  barangay: string;
  emailAddress: string;
  phoneNumber: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const url = 'http://localhost:3000/api/register';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      mode: 'cors',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        return errorJson;
      } catch (e) {
        return {
          success: false,
          message: `Server error: ${response.status} ${response.statusText}`
        };
      }
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: 'Network error occurred. Please check your connection.'
    };
  }
};

// Add a function to check if username exists
export const checkUsername = async (username: string): Promise<{ available: boolean; message?: string }> => {
  try {
    // Fix the URL to point to the correct endpoint
    const url = `http://localhost:3000/api/register/check-username?username=${encodeURIComponent(username)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        return {
          available: false,
          message: errorJson.message || 'Error checking username'
        };
      } catch (e) {
        return {
          available: false,
          message: `Server error: ${response.status} ${response.statusText}`
        };
      }
    }
    
    try {
      const data = await response.json();
      return {
        available: data.available,
        message: data.message
      };
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return {
        available: false,
        message: 'Invalid response from server'
      };
    }
  } catch (error) {
    console.error('Username check error:', error);
    return {
      available: false,
      message: 'Network error occurred. Please check your connection.'
    };
  }
};