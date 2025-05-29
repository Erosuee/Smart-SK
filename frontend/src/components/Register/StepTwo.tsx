import React, { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

interface StepTwoProps {
  password: string;
  confirmPassword: string;
  onChange: (field: string, value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const StepTwo: React.FC<StepTwoProps> = ({
  password,
  confirmPassword,
  onChange,
  onNext,
  onPrevious,
}) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  useEffect(() => {
    validatePassword();
  }, [password, confirmPassword]);

  const validatePassword = () => {
    const validations = {
      length: password.length >= 8 && password.length <= 16,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      match: password === confirmPassword && confirmPassword !== '',
    };

    setValidations(validations);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const allValid = Object.values(validations).every(v => v);
    
    if (!allValid) {
      const errorMessages = [];
      if (!validations.length) errorMessages.push('Password must be 8-16 characters long');
      if (!validations.uppercase) errorMessages.push('Password must contain at least one uppercase letter');
      if (!validations.lowercase) errorMessages.push('Password must contain at least one lowercase letter');
      if (!validations.number) errorMessages.push('Password must contain at least one number');
      if (!validations.special) errorMessages.push('Password must contain at least one special character');
      if (!validations.match) errorMessages.push('Passwords do not match');
      
      setErrors(errorMessages);
      return;
    }
    
    onNext();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <div className="password-input-container">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            value={password}
            onChange={(e) => onChange('password', e.target.value)}
            placeholder="Enter your password"
            required
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
      
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <div className="password-input-container">
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            placeholder="Confirm your password"
            required
          />
          <button 
            type="button" 
            className="password-toggle-btn"
            onClick={toggleConfirmPasswordVisibility}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {!validations.match && confirmPassword && (
          <div className="error-message">Passwords do not match</div>
        )}
      </div>
      
      <div className="password-requirements">
        <div className={`requirement ${validations.length ? 'valid' : ''}`}>
          8-16 characters
        </div>
        <div className={`requirement ${validations.uppercase ? 'valid' : ''}`}>
          At least one uppercase letter
        </div>
        <div className={`requirement ${validations.lowercase ? 'valid' : ''}`}>
          At least one lowercase letter
        </div>
        <div className={`requirement ${validations.number ? 'valid' : ''}`}>
          At least one number
        </div>
        <div className={`requirement ${validations.special ? 'valid' : ''}`}>
          At least one special character
        </div>
      </div>
      
      {errors.length > 0 && (
        <div className="error-message">
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
      
      <div className="form-actions">
        <button type="button" className="back-button" onClick={onPrevious}>
          Back
        </button>
        <button type="submit" className="next-button">
          Next
        </button>
      </div>
    </form>
  );
};

export default StepTwo;