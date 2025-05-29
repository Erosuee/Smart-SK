import React from 'react';
import { Card, Alert } from 'react-bootstrap';

// Define proper types for analysis results
interface GeneralAnalysisResult {
  success_factors?: string[];
  recommendations?: string[];
  risks?: Array<{risk: string, mitigation: string}>;
  risk_mitigation_strategies?: Array<{risk: string, mitigation: string}>;
  resource_allocation?: Record<string, string>;
  predicted_trends?: string[] | Record<string, any>;
  raw_analysis?: string;
  error?: string;
  analysis_type?: string;
  implementation_date?: string;
  estimated_duration?: string;
  feedback?: string | string[];
}

interface CustomizedAnalysisResult {
  timestamp?: string;
  analysis_type?: string;
  category?: string;
  time_period?: string;
  time_detail?: string;
  data_points?: number;
  success_factors?: string[];
  recommendations?: string[];
  risks?: Array<{risk: string, mitigation: string}>;
  risk_mitigation_strategies?: Array<{risk: string, mitigation: string}>;
  trends?: string[];
  predicted_trends?: string[] | Record<string, any>;
  budget?: {
    currency?: string;
    average?: string;
    minimum?: string;
    maximum?: string;
    median?: string;
    total?: string;
    note?: string;
    recommendation?: string;
  };
  implementation_date?: string | {
    recommended_start?: string;
    latest_start?: string;
    notes?: string;
  };
  expected_duration?: string | {
    average?: string;
    minimum?: string;
    maximum?: string;
    median?: string;
    note?: string;
    recommendation?: string;
  };
  estimated_duration?: string | {
    average?: string;
    minimum?: string;
    maximum?: string;
    median?: string;
    note?: string;
    recommendation?: string;
  };
  feedback?: string | string[];
  custom_options?: Record<string, any>;
  status?: string;
  message?: string;
  error?: string;
}

interface ProjectAnalysisResult {
  success_probability?: number;
  challenges?: string[];
  critical_factors?: string[];
  resource_optimization?: string[];
  timeline_prediction?: string;
  raw_analysis?: string;
  error?: string;
  analysis_type?: string;
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
  analysis_type?: string;
}

// Add this interface to handle the raw output response from PyBridge
interface RawOutputResult {
  rawOutput: string;
  message: string;
  analysis_id?: string;
  analysis_type?: string;
}

// Update the AnalysisResult type to include CustomizedAnalysisResult
type AnalysisResult = GeneralAnalysisResult | ProjectAnalysisResult | RecommendationsResult | RawOutputResult | CustomizedAnalysisResult;

interface PredictiveAnalysisResponseProps {
  analysisResult: AnalysisResult | null;
}

const PredictiveAnalysisResponse: React.FC<PredictiveAnalysisResponseProps> = ({ analysisResult }) => {
  if (!analysisResult) return null;

  // Add these helper functions inside the component
  const renderBudget = () => {
    if (!analysisResult) return null;
    
    // Handle CustomizedAnalysisResult type
    const budget = (analysisResult as CustomizedAnalysisResult).budget;
    
    if (!budget) return null;
    
    // Check if budget values are all "0" and add a note
    const allZeros = 
      budget.average === "0" && 
      budget.minimum === "0" && 
      budget.maximum === "0" && 
      budget.median === "0";
      
    return (
      <div className="mb-4">
        <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Budget Information</h3>
        <div className="card border-0 bg-light">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped fs-5 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Average</td>
                    <td>{budget.currency || "₱"}{budget.average}</td>
                  </tr>
                  <tr>
                    <td>Minimum</td>
                    <td>{budget.currency || "₱"}{budget.minimum}</td>
                  </tr>
                  <tr>
                    <td>Maximum</td>
                    <td>{budget.currency || "₱"}{budget.maximum}</td>
                  </tr>
                  <tr>
                    <td>Median</td>
                    <td>{budget.currency || "₱"}{budget.median}</td>
                  </tr>
                  {budget.total && (
                    <tr>
                      <td>Total</td>
                      <td>{budget.currency || "₱"}{budget.total}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {budget.note && <p className="text-muted mt-3"><i>{budget.note}</i></p>}
            {allZeros && <p className="text-danger mt-3">Note: Budget values appear to be missing or zero. These may be placeholder values.</p>}
          </div>
        </div>
      </div>
    );
  };

  // Similarly for the renderDuration function
  const renderDuration = () => {
    if (!analysisResult) return null;
    
    // Handle different result types
    const duration = 
      (analysisResult as CustomizedAnalysisResult).expected_duration || 
      (analysisResult as CustomizedAnalysisResult).estimated_duration;
    
    if (!duration) return null;
    
    // Check if all duration values are "0"
    const allZeros = 
      (typeof duration === 'object' && 
       duration.average === "0" && 
       duration.minimum === "0" && 
       duration.maximum === "0" && 
       duration.median === "0");
    
    return (
      <div className="mb-4">
        <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Expected Duration</h3>
        <div className="card border-0 bg-light">
          <div className="card-body">
            {typeof duration === 'string' ? (
              <div className="fs-5 mb-0">
                <i className="bi bi-hourglass-split text-primary me-3"></i>
                <span>{duration}</span>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-striped fs-5 mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Metric</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Average</td>
                        <td>{duration.average}</td>
                      </tr>
                      <tr>
                        <td>Minimum</td>
                        <td>{duration.minimum}</td>
                      </tr>
                      <tr>
                        <td>Maximum</td>
                        <td>{duration.maximum}</td>
                      </tr>
                      <tr>
                        <td>Median</td>
                        <td>{duration.median}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {duration.note && <p className="text-muted mt-3"><i>{duration.note}</i></p>}
                {allZeros && <p className="text-danger mt-3">Note: Duration values appear to be missing or zero. These may be placeholder values.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if ('error' in analysisResult && analysisResult.error) {
    return <Alert variant="danger">{analysisResult.error}</Alert>;
  }

  // Check if we have a raw output message (from PyBridge)
  if ('rawOutput' in analysisResult && 'message' in analysisResult) {
    // Try to extract and parse any JSON in the raw output
    try {
      // First, try to find JSON between curly braces
      const jsonStartIndex = analysisResult.rawOutput.indexOf('{');
      const jsonEndIndex = analysisResult.rawOutput.lastIndexOf('}') + 1;
      
      if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
        // Extract the JSON content
        let jsonContent = analysisResult.rawOutput.substring(jsonStartIndex, jsonEndIndex);
        
        // Clean up the JSON string - replace single quotes with double quotes (Python often uses single quotes)
        jsonContent = jsonContent.replace(/'/g, '"');
        
        // Fix unquoted property names
        jsonContent = jsonContent.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        try {
          const parsedData = JSON.parse(jsonContent);
          // Replace the analysis result with the parsed data
          return renderFormattedResult(parsedData);
        } catch (jsonError) {
          console.error("Failed to parse cleaned JSON:", jsonError);
          
          // Try a more aggressive approach - use regex to extract a valid JSON object
          const jsonRegex = /{[\s\S]*?}/g;
          const jsonMatches = analysisResult.rawOutput.match(jsonRegex);
          
          if (jsonMatches && jsonMatches.length > 0) {
            // Try each match until we find valid JSON
            for (const match of jsonMatches) {
              try {
                // Clean the match
                let cleanedMatch = match.replace(/'/g, '"');
                cleanedMatch = cleanedMatch.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
                
                const result = JSON.parse(cleanedMatch);
                return renderFormattedResult(result);
              } catch (e) {
                // Continue to the next match
                console.log("Failed to parse JSON match:", e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse JSON from raw output", e);
    }
    
    // If parsing failed, show the raw output
    return (
      <Card className="mt-4">
        <Card.Header as="h5">Analysis Results</Card.Header>
        <Card.Body>
          <Alert variant="warning">
            {analysisResult.message}
          </Alert>
          <pre className="bg-light p-3 rounded">
            {analysisResult.rawOutput}
          </pre>
        </Card.Body>
      </Card>
    );
  }

  // If we have a properly structured result, render it nicely
  return renderFormattedResult(analysisResult);
};

const renderFormattedResult = (result: any) => {
  // Determine the header title based on the analysis type
  let headerTitle = "Analysis Results"; // Default title
  
  // Check if result contains analysis_type
  if (result.analysis_type) {
    if (result.analysis_type === 'general') {
      headerTitle = "General Analysis Results";
    } else if (result.analysis_type === 'customized') {
      headerTitle = "Customized Analysis Results";
    } else if (result.analysis_type === 'specified') {
      headerTitle = "Project Analysis Results";
    }
  } else {
    // Add this console log to debug
    console.log("No analysis_type found in result:", result);
    
    // Original fallback logic
    if ('success_factors' in result || 'recommendations' in result || 'risks' in result) {
      headerTitle = "General Analysis Results";
    } else if ('success_probability' in result || 'challenges' in result) {
      headerTitle = "Project Analysis Results";
    }
  }
  
  // General Analysis Result
  if ('success_factors' in result || 'recommendations' in result || 'risks' in result || 'risk_mitigation_strategies' in result) {
    return (
      <Card className="mt-4 shadow">
        <Card.Header className="bg-primary text-white py-3">
          <h2 className="mb-0 fw-bold text-center fs-1">{headerTitle}</h2>
        </Card.Header>
        <Card.Body className="p-4">
          {/* Success Factors Section */}
          {result.success_factors && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Success Factors</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <ul className="list-unstyled fs-5 mb-0">
                    {result.success_factors.map((factor: string, index: number) => (
                      <li key={index} className="mb-2 py-2 d-flex align-items-start">
                        <i className="bi bi-check-circle-fill text-success me-3 mt-1"></i>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Recommendations Section */}
          {result.recommendations && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Recommendations</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <ul className="list-unstyled fs-5 mb-0">
                    {result.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="mb-2 py-2 d-flex align-items-start">
                        <i className="bi bi-lightbulb-fill text-warning me-3 mt-1"></i>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Risks & Mitigation Strategies Section */}
          {(result.risks || result.risk_mitigation_strategies) && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Risks & Mitigation Strategies</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-striped fs-5 mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{width: '40%'}}>Risk</th>
                          <th style={{width: '60%'}}>Mitigation Strategy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.risks || result.risk_mitigation_strategies).map((item: {risk: string, mitigation: string}, index: number) => (
                          <tr key={index}>
                            <td className="py-2">
                              <div className="d-flex align-items-center">
                                <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                                <span>{item.risk}</span>
                              </div>
                            </td>
                            <td className="py-2">
                              <div className="d-flex align-items-center">
                                <i className="bi bi-shield-fill-check text-success me-2"></i>
                                <span>{item.mitigation}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Predicted Trends Section */}
          {result.predicted_trends && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Predicted Trends</h3>
              <div className="card border-0 bg-light">
                <div className="card-body py-2 px-3">
                  <ul className="list-unstyled fs-4 fw-bold mb-0">
                    {Array.isArray(result.predicted_trends) ? (
                      result.predicted_trends.map((item: string, index: number) => (
                        <li key={index} className="mb-2 py-2 d-flex align-items-start">
                          <i className="bi bi-check-circle-fill text-success me-3 mt-1"></i>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      Object.entries(result.predicted_trends).map(([key, value]: [string, any], index: number) => (
                        <li key={index} className="mb-2 py-2 d-flex align-items-start">
                          <i className="bi bi-check-circle-fill text-success me-3 mt-1"></i>
                          <span>
                            {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Expected Budget Section */}
          {result.expected_budget && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Expected Budget</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <div className="mb-3">
                    {Object.entries(result.expected_budget)
                      .filter(([key]) => ['average', 'minimum', 'maximum', 'median'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="mb-2">
                          <div className="d-flex align-items-center">
                            <div className="text-muted fs-5 me-3" style={{width: '100px'}}>{key.charAt(0).toUpperCase() + key.slice(1)}:</div>
                            <div className="fs-5 fw-bold text-success">{String(value)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {result.expected_budget.recommendation && (
                    <div className="alert alert-light border-start border-success border-4 mt-2 fs-5 py-2 mb-0">
                      <i className="bi bi-info-circle-fill text-success me-2"></i>
                      {String(result.expected_budget.recommendation)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Implementation Date Section */}
          {result.implementation_date && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Implementation Date</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <div className="fs-5 mb-0">
                    <i className="bi bi-calendar-date text-primary me-3"></i>
                    <span>{String(result.implementation_date)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Expected Duration Section */}
          {(result.expected_duration || result.estimated_duration) && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Expected Duration</h3>
              <div className="card border-0 bg-light">
                <div className="card-body">
                  {typeof (result.expected_duration || result.estimated_duration) === 'string' ? (
                    <div className="fs-5 mb-0">
                      <i className="bi bi-hourglass-split text-primary me-3"></i>
                      <span>{String(result.expected_duration || result.estimated_duration)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <table className="table table-striped fs-5 mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Metric</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Average</td>
                              <td>{(result.expected_duration || result.estimated_duration).average}</td>
                            </tr>
                            <tr>
                              <td>Minimum</td>
                              <td>{(result.expected_duration || result.estimated_duration).minimum}</td>
                            </tr>
                            <tr>
                              <td>Maximum</td>
                              <td>{(result.expected_duration || result.estimated_duration).maximum}</td>
                            </tr>
                            <tr>
                              <td>Median</td>
                              <td>{(result.expected_duration || result.estimated_duration).median}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {(result.expected_duration || result.estimated_duration).note && 
                        <p className="text-muted mt-3"><i>{(result.expected_duration || result.estimated_duration).note}</i></p>}
                      {(result.expected_duration || result.estimated_duration).average === "0" && 
                       (result.expected_duration || result.estimated_duration).minimum === "0" && 
                       (result.expected_duration || result.estimated_duration).maximum === "0" && 
                       (result.expected_duration || result.estimated_duration).median === "0" && 
                        <p className="text-danger mt-3">Note: Duration values appear to be missing or zero. These may be placeholder values.</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Feedback Section */}
          {result.feedback && (
            <div className="mb-4">
              <h3 className="text-primary mb-3 pb-2 border-bottom border-primary fw-bold fs-2">Feedback</h3>
              {Array.isArray(result.feedback) ? (
                <ul className="list-unstyled fs-5">
                  {result.feedback.map((item: string, index: number) => (
                    <li key={index} className="mb-2 py-2 d-flex align-items-start">
                      <i className="bi bi-chat-square-text-fill text-primary me-3 mt-1"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card border-0 bg-light">
                  <div className="card-body">
                    <p className="mb-0 fs-5">
                      <i className="bi bi-chat-square-text-fill text-primary me-2"></i>
                      {String(result.feedback)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }
  
  // Project Analysis Result
  else if ('success_probability' in result || 'challenges' in result) {
    return (
      <Card className="mt-4 shadow-sm">
        <Card.Header className="bg-primary text-white py-4">
          <h2 className="mb-0 fw-bold">{headerTitle}</h2>
        </Card.Header>
        <Card.Body className="p-5">
          {result.success_probability !== undefined && (
            <div className="mb-5 pb-4">
              <h3 className="text-primary mb-4 pb-2 border-bottom fw-bold">Success Probability</h3>
              <div className="mt-4 text-center">
                <div className="progress" style={{ height: '30px' }}>
                  <div 
                    className={`progress-bar ${result.success_probability > 70 ? 'bg-success' : result.success_probability > 40 ? 'bg-warning' : 'bg-danger'}`}
                    role="progressbar" 
                    style={{ width: `${result.success_probability}%` }}
                    aria-valuenow={result.success_probability} 
                    aria-valuemin={0} 
                    aria-valuemax={100}
                  >
                    {result.success_probability}%
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {result.challenges && (
            <div className="mb-5 pb-4">
              <h3 className="text-primary mb-4 pb-2 border-bottom fw-bold">Challenges</h3>
              <div className="mt-4">
                <ul className="list-group">
                  {result.challenges.map((challenge: string, index: number) => (
                    <li key={index} className="list-group-item py-3">
                      <i className="bi bi-exclamation-circle-fill text-danger me-2"></i>
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {result.critical_factors && (
            <div className="mb-5 pb-4">
              <h3 className="text-primary mb-4 pb-2 border-bottom fw-bold">Critical Success Factors</h3>
              <div className="mt-4">
                <ul className="list-group">
                  {result.critical_factors.map((factor: string, index: number) => (
                    <li key={index} className="list-group-item py-3">
                      <i className="bi bi-star-fill text-warning me-2"></i>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {result.resource_optimization && (
            <div className="mb-5 pb-4">
              <h3 className="text-primary mb-4 pb-2 border-bottom fw-bold">Resource Optimization</h3>
              <div className="mt-4">
                <ul className="list-group">
                  {result.resource_optimization.map((item: string, index: number) => (
                    <li key={index} className="list-group-item py-3">
                      <i className="bi bi-gear-fill text-secondary me-2"></i>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {result.timeline_prediction && (
            <div className="mb-5">
              <h3 className="text-primary mb-4 pb-2 border-bottom fw-bold">Timeline Prediction</h3>
              <div className="mt-4">
                <div className="alert alert-info py-3">
                  <i className="bi bi-clock-fill me-2"></i>
                  {result.timeline_prediction}
                </div>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }
  
  // Recommendations Result
  else if ('project_ideas' in result) {
    return (
      <Card className="mt-4 shadow-sm">
        <Card.Header className="bg-primary text-white py-4">
          <h2 className="mb-0 fw-bold">{headerTitle}</h2>
        </Card.Header>
        <Card.Body className="p-5">
          {result.project_ideas && result.project_ideas.map((idea: ProjectIdea, index: number) => (
            <Card key={index} className="mb-5 shadow-sm">
              <Card.Header className="bg-light py-3">
                <h3 className="mb-0 fw-bold">{idea.name}</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <p className="lead mb-4">{idea.description}</p>
                
                <div className="row mt-4">
                  <div className="col-md-6 mb-4">
                    <h4 className="text-primary mb-3 pb-2 border-bottom fw-bold"><i className="bi bi-bullseye me-2"></i>Expected Outcomes</h4>
                    <div className="mt-3">
                      <ul className="list-group">
                        {idea.expected_outcomes.map((outcome, i) => (
                          <li key={i} className="list-group-item py-3">{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="col-md-6 mb-4">
                    <h4 className="text-primary mb-3 pb-2 border-bottom fw-bold"><i className="bi bi-tools me-2"></i>Required Resources</h4>
                    <div className="mt-3">
                      <ul className="list-group">
                        {idea.resources.map((resource, i) => (
                          <li key={i} className="list-group-item py-3">{resource}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="row mt-4">
                  <div className="col-md-6 mb-4">
                    <h4 className="text-primary mb-3 pb-2 border-bottom fw-bold"><i className="bi bi-calendar-check me-2"></i>Timeline</h4>
                    <div className="mt-3">
                      <div className="alert alert-info py-3">{idea.timeline}</div>
                    </div>
                  </div>
                  
                  <div className="col-md-6 mb-4">
                    <h4 className="text-primary mb-3 pb-2 border-bottom fw-bold"><i className="bi bi-graph-up me-2"></i>Success Metrics</h4>
                    <div className="mt-3">
                      <ul className="list-group">
                        {idea.success_metrics.map((metric, i) => (
                          <li key={i} className="list-group-item py-3">{metric}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))}
        </Card.Body>
      </Card>
    );
  }
  
  // Fallback for unknown result format
  return (
    <Card className="mt-4">
      <Card.Header as="h5">Analysis Results</Card.Header>
      <Card.Body>
        <pre className="bg-light p-3 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      </Card.Body>
    </Card>
  );
};

export default PredictiveAnalysisResponse;