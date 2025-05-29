import React from 'react';

interface StepThreeProps {
  fullName: string;
  position: string;
  barangay: string;
  emailAddress: string;
  phoneNumber: string;
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPrevious: () => void;
  errors: string[];
  isSubmitting: boolean;
}

const StepThree: React.FC<StepThreeProps> = ({
  fullName,
  position,
  barangay,
  emailAddress,
  phoneNumber,
  onChange,
  onSubmit,
  onPrevious,
  errors,
  isSubmitting
}) => {
  return (
    <form onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="error-message">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="fullName">Full Name</label>
        <input
          type="text"
          id="fullName"
          value={fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="position">Position</label>
        <input
          type="text"
          id="position"
          value={position}
          onChange={(e) => onChange('position', e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="barangay">Barangay</label>
        <select
          id="barangay"
          value={barangay}
          onChange={(e) => onChange('barangay', e.target.value)}
          required
          disabled={isSubmitting}
        >
          <option value="">Select Barangay</option>
          <option value="Bagbag">Bagbag</option>
          <option value="Gulod">Gulod</option>
          <option value="Sta. Monica">Sta. Monica</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="emailAddress">Email Address</label>
        <input
          type="email"
          id="emailAddress"
          value={emailAddress}
          onChange={(e) => onChange('emailAddress', e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="phoneNumber">Phone Number</label>
        <input
          type="tel"
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => onChange('phoneNumber', e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      
      <div className="button-container">
        <button
          type="button"
          onClick={onPrevious}
          className="back-btn"
          disabled={isSubmitting}
        >
          Back
        </button>
        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
};

export default StepThree;