import { useState, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

interface LoginCredentials {
  username: string;
  password: string;
}

// Update the interface to match the actual response from your backend
interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: number;
    username: string;
    fullName: string;
    position: string;
    barangay?: string;
  };
}

const Login: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: credentials.username, 
          password: credentials.password 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Make sure to save the token properly
      if (data.token) {
        localStorage.setItem('token', data.token);
      } else {
        console.error('No token received from server');
        setError('Authentication error: No token provided');
        setIsLoading(false);
        return;
      }
      
      // Save user data and update auth context
      if (data.user) {
        // Convert backend user format to our User interface format
        const userData = {
          id: data.user.id,
          username: data.user.username,
          fullname: data.user.fullName || data.user.fullname, // Handle both cases
          position: data.user.position,
          barangay: data.user.barangay || ''
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        login(userData);
        navigate('/dashboard');
      } else {
        console.error('No user data received from server');
        setError('Authentication error: No user data received');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        setError(error.message || 'Invalid username or password');
      } else {
        setError('Invalid username or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-panel">
        <div className="logo-container">
          <h1>Smart SK</h1>
          <p>A Web-based Project Monitoring System</p>
        </div>
      </div>
      
      <div className="login-right-panel">
        <div className="login-form-container">
          <h2>Login to your account</h2>
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                required
                disabled={isLoading}
                placeholder="Enter your username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="Enter your password"
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            
            <div className="form-links">
                <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            
            <div className="register-link">
              Don't have an account? <Link to="/register">Register here</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;