import React, { useState, useEffect } from 'react';

interface StepOneProps {
  username: string;
  onChange: (field: string, value: string) => void;
  onNext: () => void;
}

const StepOne: React.FC<StepOneProps> = ({ username, onChange, onNext }) => {
  const [error, setError] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange('username', e.target.value);
    setError('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    try {
      setIsChecking(true);
      setError('');
      
      const response = await fetch(`http://localhost:3000/api/register/check-username?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to check username');
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (data.available) {
          onNext();
        } else {
          setError('Username already exists. Please choose another.');
        }
      } else {
        setError(data.message || 'Failed to check username');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setError('An error occurred while checking username availability');
    } finally {
      setIsChecking(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="register-step">
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Enter your username"
          className={error ? 'error' : ''}
        />
        {error && <div className="error-message">{error}</div>}
      </div>
      <div className="form-actions">
        <button type="submit" className="next-button" disabled={isChecking}>
          {isChecking ? 'Checking...' : 'Next'}
        </button>
      </div>
      <div className="login-link">
        Already have an account? <a href="/login">Login here</a>
      </div>
    </form>
  );
};

export default StepOne;