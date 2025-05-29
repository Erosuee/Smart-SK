// src/pages/PredictiveAnalysis/pa.tsx

import React, { useState, useCallback, useEffect } from 'react';
import Layout from '../Layout/Layout';
import { Card, Button, Form, Row, Col, Spinner, Alert, Tab, Tabs, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { toast } from 'react-toastify';
import PredictiveAnalysisResponse from './paResponse'; // Existing component for general results
import PaCstmResponse, { PaCstmApiResponse } from './paCstmResponse'; // **** ADDED: Import the new component and its main interface ****
const API_URL = 'http://localhost:3000';  // Make sure this matches your backend server port
import './pa.css';

// --- Interfaces ---

// Define proper types for analysis results (Original/General)
interface GeneralAnalysisResult {
  success_factors?: string[];
  recommendations?: string[];
  risks?: Array<{risk: string, mitigation: string}>;
  resource_allocation?: Record<string, string>;
  predicted_trends?: string[] | Record<string, any>; // Update to handle both array and object
  raw_analysis?: string;
  error?: string;
  analysis_type?: string; // Add this field
  implementation_date?: string; // Add this field
  estimated_duration?: string; // Add this field
  feedback?: string | string[]; // Add this field
  timestamp?: string; // Add this field for error responses
}

// Removed CustomizedAnalysisResult interface as PaCstmApiResponse replaces it

interface ProjectAnalysisResult {
  success_probability?: number;
  challenges?: string[];
  critical_factors?: string[];
  resource_optimization?: string[];
  timeline_prediction?: string;
  raw_analysis?: string;
  error?: string;
}

interface ProjectIdea {
  name: string;
  description: string;
  expected_outcomes: string[];
  resources: string[];
  timeline: string;
  success_metrics: string[];
}

interface RecommendationsResult {
  project_ideas?: ProjectIdea[];
  raw_analysis?: string;
  error?: string;
}

// Add this interface to handle the raw output response from PyBridge
interface RawOutputResult {
  rawOutput: string;
  message: string;
  analysis_id?: string; // Add this field
  analysis_type?: string; // Add this field
}

// **** MODIFIED: Update AnalysisResult to include PaCstmApiResponse and null ****
type AnalysisResult = GeneralAnalysisResult | ProjectAnalysisResult | RecommendationsResult | RawOutputResult | PaCstmApiResponse | null;

const PredictiveAnalysis: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // **** MODIFIED: Update state type to use the new AnalysisResult union ****
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(null);

  // Form states for customization options
  const [timePeriod, setTimePeriod] = useState<string>('None');
  const [category, setCategory] = useState<string>('None');

  // Checkboxes for response customization
  const [includeBudget, setIncludeBudget] = useState<boolean>(true);
  const [includeDuration, setIncludeDuration] = useState<boolean>(true);
  const [includeImplementDate, setIncludeImplementDate] = useState<boolean>(true);
  const [includeRecommendations, setIncludeRecommendations] = useState<boolean>(true);
  const [includeRisks, setIncludeRisks] = useState<boolean>(true);
  const [includeTrends, setIncludeTrends] = useState<boolean>(true);
  const [includeSuccessFactors, setIncludeSuccessFactors] = useState<boolean>(true);
  const [includeFeedback, setIncludeFeedback] = useState<boolean>(true);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Add state for tracking analysis progress
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{status: string, progress: number} | null>(null);

  // Add state for time period sub-category
  const [timeSubCategory, setTimeSubCategory] = useState<string>('');

  // Function to handle general analysis (moved before useEffect)
  const runGeneralAnalysis = useCallback(async (params: any) => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null); // **** ADDED: Clear previous results ****

    try {
      toast.info(
        "Running general analysis using historical data. This could take some time, please wait...",
        {
          position: "top-right",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );

      // Make sure to include time_sub_category in params
      if (!params.time_sub_category && timeSubCategory) {
        params.time_sub_category = timeSubCategory;
      }

      console.log('Running general predictive analysis with options:', params);

      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');

      // Set up request headers with authentication
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      };

      // Always call the predictive-analysis endpoint for general analysis (pa.py)
      // **** MODIFIED: Specify expected type ****
      const response = await axios.post<GeneralAnalysisResult>(`${API_URL}/api/predictive-analysis`, params, { headers });
      console.log('Received general analysis response:', response.data);

      // Set the result (explicitly casting for clarity)
      // **** MODIFIED: Cast result ****
      setAnalysisResult(response.data as GeneralAnalysisResult);

      // Also set the error state if there's an error in the response
      if (response.data && response.data.error) {
        setError(response.data.error);
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to run general analysis. Please try again.';
      setError(errorMessage);

      // Set a minimal result with the error so paResponse can display it
      // **** MODIFIED: Set minimal error structure ****
      setAnalysisResult({
        error: errorMessage,
        timestamp: new Date().toISOString()
      } as GeneralAnalysisResult); // Cast to General for paResponse

      console.error('Error running general analysis:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Remove timeSubCategory dependency to prevent auto-refresh

  // Add useEffect to run general analysis on component mount
  useEffect(() => {
    // Prepare general parameters (all true or defaults)
    const generalParams = {
      analysis_type: 'general',
      time_period: 'None',
      category: 'None',
      time_sub_category: '',
      // Explicitly include all sections for general response
      include_budget: true,
      include_duration: true,
      include_implement_date: true,
      include_recommendations: true,
      include_risks: true,
      include_trends: true,
      include_success_factors: true,
      include_feedback: true
    };
    // Run general analysis when component mounts
    runGeneralAnalysis(generalParams);
  }, []); // Use empty dependency array to run only on mount

  // Add a function to poll for progress updates (Keep implementation)
  const pollAnalysisProgress = useCallback((id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/predictive-analysis/progress/${id}`);
        setAnalysisProgress(response.data);

        // If progress is complete, stop polling
        if (response.data.status === 'completed' || response.data.progress >= 100) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error polling for progress:", error);
      }
    }, 1000); // Poll every second

    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Function to get time sub-category options based on selected time period (Keep implementation)
  const getTimeSubCategoryOptions = () => {
    const currentYear = new Date().getFullYear();

    if (timePeriod === 'Yearly') {
      // Years from 2025 to 2050
      return Array.from({length: 26}, (_, i) => (2025 + i).toString());
    } else if (timePeriod === 'Quarterly') {
      // Quarters of current year
      return ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
    } else if (timePeriod === 'Monthly') {
      // Months of current year
      return [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
    }
    return [];
  };

  // Update the existing runAnalysis function (Handles "Apply Filter" for Customized)
  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null); // **** ADDED: Clear previous results ****
    setAnalysisProgress(null);

    // Always use 'customized' analysis_type when Apply Filter is clicked
    // This ensures paCstm.py is called (unless a file is selected)
    const analysisType = selectedFile ? 'specified' : 'customized'; // Keep this logic

    try {
      toast.info(
        selectedFile
          ? "Analyzing your uploaded file. This could take some time, please wait..."
          : "Running customized analysis. This could take some time, please wait...",
        {
          position: "top-right",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );

      // Prepare the options object with all necessary fields
      const options = {
        analysis_type: analysisType,
        time_period: timePeriod,
        time_detail: timeSubCategory || '',
        category: category,
        include_budget: includeBudget,
        include_duration: includeDuration,
        include_implement_date: includeImplementDate,
        include_recommendations: includeRecommendations,
        include_risks: includeRisks,
        include_trends: includeTrends,
        include_success_factors: includeSuccessFactors,
        include_feedback: includeFeedback
      };

      console.log('Running analysis with options:', options);

      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');

      // Set up request headers with authentication
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      };

      // For customized analysis (Apply Filter without file), call the endpoint for paCstm.py
      if (analysisType === 'customized') {
        const requestData = {
          data: {
            primary_data: [] // This will be filled from the backend if needed
          },
          options: {
            ...options,
            // Ensure boolean values are properly passed
            include_budget: includeBudget === true,
            include_duration: includeDuration === true,
            include_implement_date: includeImplementDate === true,
            include_recommendations: includeRecommendations === true,
            include_risks: includeRisks === true,
            include_trends: includeTrends === true,
            include_success_factors: includeSuccessFactors === true,
            include_feedback: includeFeedback === true
          }
        };

        console.log('Sending customized analysis request with data:', requestData);

        // Call the customized-analysis endpoint which should trigger paCstm.py
        // **** MODIFIED: Specify expected type ****
        const response = await axios.post<PaCstmApiResponse>(`${API_URL}/api/customized-analysis`, requestData, { headers });
        console.log('Received customized analysis response:', response.data);

        // Set the result (explicitly casting for clarity)
        // **** MODIFIED: Cast result ****
        setAnalysisResult(response.data as PaCstmApiResponse);

        // **** MODIFIED: Handle errors reported within the PaCstmApiResponse structure ****
        if (response.data?.analysis_results?.status && response.data.analysis_results.status !== 'success') {
            setError(response.data.analysis_results.error || `Analysis ${response.data.analysis_results.status}`);
        } else if (response.data?.error) { // Handle top-level errors returned in the structure
           setError(response.data.error);
        }

      } else {
        // For file upload ('specified') or other types, use the existing predictive-analysis endpoint
        // **** ASSUMPTION: File upload uses the general endpoint/structure. Adjust if needed. ****
        // **** MODIFIED: Specify expected type ****
        const response = await axios.post<GeneralAnalysisResult>(`${API_URL}/api/predictive-analysis`, options, { headers });
        console.log('Received analysis response (non-customized/file):', response.data);

        // Set the result
        // **** MODIFIED: Cast result ****
        setAnalysisResult(response.data as GeneralAnalysisResult);

        // Also set the error state if there's an error in the response
        if (response.data && response.data.error) {
          setError(response.data.error);
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to run analysis. Please try again.';
      setError(errorMessage);

      // Set a minimal result with the error, trying to make it compatible with PaCstmResponse's error display
      // **** MODIFIED: Set error structure compatible with PaCstmResponse ****
      setAnalysisResult({
        analysis_metadata: { timestamp: new Date().toISOString() }, // Minimal metadata for context
        analysis_results: { status: 'failed', error: errorMessage }, // Results indicate failure
        error: errorMessage // Also include top-level error if possible
      } as PaCstmApiResponse);

      console.error('Error running analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a progress indicator component (Keep implementation)
  const renderProgressIndicator = () => {
    if (!analysisProgress) return null;
    return (
      <div className="analysis-progress mt-3 mb-4">
        <h5>Analysis Progress: {analysisProgress.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h5>
        <div className="progress" style={{ height: '20px' }}>
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            role="progressbar"
            style={{ width: `${analysisProgress.progress}%` }}
            aria-valuenow={analysisProgress.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {analysisProgress.progress}%
          </div>
        </div>
      </div>
    );
  };

  const renderCustomizedAnalysisForm = () => (
    <div className="mb-4">
      <h3 className="forecast-title">Customize Response</h3>
      <div className="forecast-filters">
        <Card className="mb-3" style={{ border: '1px solid #dee2e6', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <Card.Body className="pb-2">
            <div className="filter-row">
              <div className="filter-group">
                <label>Category</label>
                <div className="select-wrapper">
                  <Form.Select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      // No auto-analysis after selection
                    }}
                  >
                    <option value="None">All Categories</option>
                    <option value="Training">Training</option>
                    <option value="Sports Events">Sports Events</option>
                    <option value="Scholarship">Scholarship</option>
                    <option value="Arts & Culture">Arts & Culture</option>
                    <option value="Feeding Program">Feeding Program</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                </div>
              </div>
              {/* Time Period Select */}
              <div className="filter-group">
                <label>Time Period</label>
                <div className="select-wrapper">
                  <Form.Select
                    value={timePeriod}
                    onChange={(e) => {
                      setTimePeriod(e.target.value);
                      setTimeSubCategory('');
                      // No auto-analysis after selection
                    }}
                  >
                    <option value="None">None</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Monthly">Monthly</option>
                  </Form.Select>
                </div>
              </div>
              {/* Time Period Detail Select */}
              <div className="filter-group">
                <label>Time Period Detail</label>
                <div className="select-wrapper">
                  <Form.Select
                    value={timeSubCategory}
                    onChange={(e) => {
                      setTimeSubCategory(e.target.value);
                      // No auto-analysis after selection
                    }}
                    disabled={!timePeriod || timePeriod === 'None'}
                  >
                    <option value="">Select {timePeriod}</option>
                    {getTimeSubCategoryOptions().map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card style={{ border: '1px solid #dee2e6', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <Card.Body className="pt-2 pb-3">
            {/* Second row: First set of checkboxes */}
            <div className="filter-row mt-2">
              <div className="checkbox-item">
                <span className="checkbox-label">Success Factors</span>
                <Form.Check type="checkbox" id="include-success-factors" checked={includeSuccessFactors} onChange={(e) => setIncludeSuccessFactors(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label">Recommendations</span>
                <Form.Check type="checkbox" id="include-recommendations" checked={includeRecommendations} onChange={(e) => setIncludeRecommendations(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label" style={{ fontSize: '0.9em' }}>Risk & Mitigation Strategies</span>
                <Form.Check type="checkbox" id="include-risks" checked={includeRisks} onChange={(e) => setIncludeRisks(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label">Predicted Trends</span>
                <Form.Check type="checkbox" id="include-trends" checked={includeTrends} onChange={(e) => setIncludeTrends(e.target.checked)} className="custom-checkbox" />
              </div>
            </div>

            {/* Third row: Second set of checkboxes */}
            <div className="filter-row mt-3">
              <div className="checkbox-item">
                <span className="checkbox-label">Budget</span>
                <Form.Check type="checkbox" id="include-budget" checked={includeBudget} onChange={(e) => setIncludeBudget(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label">Implementation Date</span>
                <Form.Check type="checkbox" id="include-implement-date" checked={includeImplementDate} onChange={(e) => setIncludeImplementDate(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label">Estimated Duration</span>
                <Form.Check type="checkbox" id="include-duration" checked={includeDuration} onChange={(e) => setIncludeDuration(e.target.checked)} className="custom-checkbox" />
              </div>
              <div className="checkbox-item">
                <span className="checkbox-label">Feedback</span>
                <Form.Check type="checkbox" id="include-feedback" checked={includeFeedback} onChange={(e) => setIncludeFeedback(e.target.checked)} className="custom-checkbox" />
              </div>
            </div>

            {/* Button row - Only Apply Filter button now */}
            <div className="mt-3" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={runAnalysis} // This calls the function that handles 'customized' type
                disabled={loading}
              >
                {loading ? "Running Analysis..." : "Apply Filter"}
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );

  const isCustomizedResult = (result: AnalysisResult): result is PaCstmApiResponse => {
      return result !== null &&
             typeof result === 'object' &&
             'analysis_metadata' in result &&
             'analysis_results' in result &&
             typeof result.analysis_metadata === 'object' && 
             typeof result.analysis_results === 'object';   
  };

  return (
    <Layout>
      <div className="predictive-analysis-container">
        <h2>Predictive Analysis</h2>
        <p className="lead">
          Use AI-powered predictive analysis to gain insights into project success factors,
          outcomes, and recommendations.
        </p>

        {error && !isCustomizedResult(analysisResult) && <Alert variant="danger">{error}</Alert>}
 
        {renderProgressIndicator()}

        <Card className="mb-4">
          <Card.Body>
            {renderCustomizedAnalysisForm()}
          </Card.Body>
        </Card>

        <div className="analysis-results-section">

          {loading && !analysisResult && (
              <div className="text-center mt-4">
                  <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading...</span>
                  </Spinner>
                  <p>Loading analysis results...</p>
              </div>
          )}

          {!loading && isCustomizedResult(analysisResult) && (
            <PaCstmResponse
              analysisResult={analysisResult}
              isLoading={false} 
            />
          )}

          {!loading && !isCustomizedResult(analysisResult) && analysisResult && (
              <PredictiveAnalysisResponse
                  analysisResult={analysisResult as GeneralAnalysisResult | null} 
              />
          )}

          {/* Display initial message or message when no results after loading */}
          {!loading && !analysisResult && !error && (
               <Alert variant="secondary" className="mt-4">Select filters and run analysis to see results.</Alert>
           )}
        </div>
      </div>
    </Layout>
  );
};

export default PredictiveAnalysis;