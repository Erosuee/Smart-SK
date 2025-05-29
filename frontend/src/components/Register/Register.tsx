import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepOne from './StepOne';
import StepTwo from './StepTwo';
import StepThree from './StepThree';
import RegistrationComplete from './RegistrationComplete';
import './Register.css';

import { register } from '../../backend connection/auth';

interface RegistrationData {
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  position: string;
  barangay: string;
  emailAddress: string;
  phoneNumber: string;
}

const Register: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    position: '',
    barangay: '',
    emailAddress: '',
    phoneNumber: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleNext = () => {
    setStep(step + 1);
  };

  const handlePrevious = () => {
    setStep(step - 1);
  };

  // Fixed onChange handler with proper typing
  const handleChange = (field: string, value: string) => {
    setRegistrationData({
      ...registrationData,
      [field]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step !== 3) {
      handleNext();
      return;
    }
    
    setIsSubmitting(true);
    setErrors([]);
    
    try {
      // Make sure all required fields are filled
      if (!registrationData.fullName || !registrationData.position || 
          !registrationData.barangay || !registrationData.emailAddress || 
          !registrationData.phoneNumber) {
        setErrors(['All fields are required']);
        setIsSubmitting(false);
        return;
      }
      
      const response = await register({
        username: registrationData.username,
        password: registrationData.password,
        fullName: registrationData.fullName,
        position: registrationData.position,
        barangay: registrationData.barangay,
        emailAddress: registrationData.emailAddress,
        phoneNumber: registrationData.phoneNumber
      });
      
      if (response.success) {
        setStep(4); // Move to registration complete step
      } else {
        setErrors([response.message || 'Registration failed. Please try again.']);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors(['An error occurred. Please try again later.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepOne
            username={registrationData.username}
            onChange={handleChange}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <StepTwo
            password={registrationData.password}
            confirmPassword={registrationData.confirmPassword}
            onChange={handleChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 3:
        return (
          <StepThree
            fullName={registrationData.fullName}
            position={registrationData.position}
            barangay={registrationData.barangay}
            emailAddress={registrationData.emailAddress}
            phoneNumber={registrationData.phoneNumber}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onPrevious={handlePrevious}
            errors={errors}
            isSubmitting={isSubmitting}
          />
        );
      case 4:
        return <RegistrationComplete />;
      default:
        return null;
    }
  };

  return (
    <div className="register-container">
      <div className="register-left-panel">
        <div className="logo-container">
          <h1>Smart SK</h1>
          <p>A Web-based Project Monitoring System</p>
        </div>
      </div>
      <div className="register-right-panel">
        <div className="register-form-container">
          <h2>Create an Account</h2>
          <div className="step-indicator">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className="step-line"></div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className="step-line"></div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
          </div>
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default Register;