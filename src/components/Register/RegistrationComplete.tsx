import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle } from 'react-icons/fa';
import './Register.css';

const RegistrationComplete: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Add animation class after component mounts
    const successIcon = document.querySelector('.success-icon');
    if (successIcon) {
      successIcon.classList.add('animate');
    }
  }, []);

  return (
    <div className="registration-complete">
      <div className="success-icon-container">
        <FaCheckCircle className="success-icon animate" />
      </div>
      <h3>Registration Submitted</h3>
      <p>
        Your account is being verified. Please wait for the admin to approve your account.
        You will receive a notification on your registered email once your account has been approved.
      </p>
      <button 
        className="back-to-login" 
        onClick={() => navigate('/login')}
      >
        Back to Login
      </button>
    </div>
  );
};

export default RegistrationComplete;