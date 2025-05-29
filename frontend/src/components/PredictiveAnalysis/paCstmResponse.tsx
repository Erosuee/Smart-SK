// src/components/paCstmResponse.tsx
import React from 'react';
import { Card, Alert, Table, ListGroup, Badge, Spinner } from 'react-bootstrap';

// --- Interfaces matching paCstm.py Output Structure (Keep As Is) ---

interface PaCstmRisk {
    risk: string;
    mitigation: string;
}

interface PaCstmBudgetAnalysis {
    currency?: string;
    average_numeric?: number | null;
    comment?: string;
    average_budget_value?: number | null;
}

interface PaCstmAnalysisResults {
    success_factors?: string[];
    recommendations?: string[];
    risks?: PaCstmRisk[];
    trends?: string[];
    budget_analysis?: PaCstmBudgetAnalysis;
    typical_implementation_timeline?: string;
    typical_duration?: string;
    potential_feedback_areas?: string[];
    analysis_summary?: string;
    status?: 'success' | 'failed' | 'skipped';
    error?: string;
    details?: string;
    raw_response_preview?: string;
}

// **** REMOVED: PaCstmAnalysisMetadata interface is no longer needed ****
// interface PaCstmAnalysisMetadata { ... }

// Overall structure expected from the API endpoint calling paCstm.py
export interface PaCstmApiResponse {
    // **** REMOVED: analysis_metadata is no longer used in the component ****
    // analysis_metadata: PaCstmAnalysisMetadata;
    analysis_results: PaCstmAnalysisResults;
    error?: string;
    status?: string;
    details?: string;
    // **** ADDED: Include metadata optionally in the response type if backend still sends it ****
    // Add it back if you might need it elsewhere, even if not displayed here.
    analysis_metadata?: any; // Use 'any' or define the interface if needed elsewhere
}

// --- Component Props ---
interface PaCstmResponseProps {
    analysisResult: PaCstmApiResponse | null;
    isLoading?: boolean;
}

// --- Helper Rendering Functions (Modified) ---

// Renders lists using standard <ul><li> bullets
// Special handling for trends to make them more readable
const renderListSection = (title: string, items: string[] | undefined, colorClass: string) => {
    if (!items || items.length === 0) return null;
    
    // Special handling for Trends section
    if (title === "Trends") {
        return (
            <div className="mb-4">
                <h3 className={`text-${colorClass} mb-3 pb-2 border-bottom border-${colorClass} fw-bold fs-4`}>Predicted Trends</h3>
                <Card className="border-0 bg-light">
                    <Card.Body className="py-2 px-3">
                        <ul className="list-unstyled fs-5 fw-bold mb-0">
                            {items.map((item: string, index: number) => (
                                <li key={index} className="mb-2 py-2 d-flex align-items-start">
                                    <i className="bi bi-check-circle-fill text-success me-3 mt-1"></i>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </Card.Body>
                </Card>
            </div>
        );
    }
    
    // Standard rendering for other list sections
    return (
        <div className="mb-4">
            <h3 className={`text-${colorClass} mb-3 pb-2 border-bottom border-${colorClass} fw-bold fs-4`}>{title}</h3>
            <Card className="border-0 bg-light">
                <Card.Body className="py-2 px-3">
                    <ul className="fs-5 mb-0 ps-4">
                        {items.map((item: string, index: number) => (
                            <li key={index} className="mb-1">
                                {item}
                            </li>
                        ))}
                    </ul>
                </Card.Body>
            </Card>
        </div>
    );
};

// Renders the Risks table
// **** MODIFIED: Simplified td content to potentially fix hydration ****
const renderRisksSection = (risks: PaCstmRisk[] | undefined) => {
    if (!risks || risks.length === 0) return null;
    return (
        <div className="mb-4">
            <h3 className="text-danger mb-3 pb-2 border-bottom border-danger fw-bold fs-4">Risks & Mitigation</h3>
            <div className="card border-0 bg-light">
                <div className="card-body py-2 px-3">
                    <div className="table-responsive">
                        {/* Ensure no extraneous whitespace around table elements */}
                        <Table striped hover responsive className="fs-6 mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: '40%' }}>Risk</th>
                                    <th style={{ width: '60%' }}>Mitigation Strategy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {risks.map((item, index) => (
                                    <tr key={index}>
                                        {/* Removed icons from td */}
                                        <td className="py-2 align-middle">{item.risk}</td>
                                        <td className="py-2 align-middle">{item.mitigation}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    );
};


// Renders the Budget Analysis section
// **** MODIFIED: Removed icon ****
const renderBudgetSection = (budgetAnalysis: PaCstmBudgetAnalysis | undefined) => {
    if (!budgetAnalysis) return null;
    const avgValue = budgetAnalysis.average_numeric ?? budgetAnalysis.average_budget_value;
    const currency = budgetAnalysis.currency || 'PHP'; // Default currency
    const comment = budgetAnalysis.comment;

    return (
        <div className="mb-4">
            <h3 className="text-success mb-3 pb-2 border-bottom border-success fw-bold fs-4">Budget Analysis</h3>
            <div className="card border-0 bg-light">
                <div className="card-body py-3 px-3">
                    {avgValue !== null && avgValue !== undefined ? (
                        <p className="fs-5 mb-2">
                            Calculated Average Budget: <strong>{currency} {avgValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </p>
                    ) : (
                        <p className="fs-5 text-muted mb-2">Average budget could not be calculated from available data.</p>
                    )}
                    {comment && (
                         <p className="fs-6 mt-1 mb-0 fst-italic">Note: {comment}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Renders simple text sections (Timeline, Duration, Summary)
// **** MODIFIED: Removed iconClass parameter and icon ****
const renderTextSection = (title: string, text: string | undefined, colorClass: string) => {
    if (!text) return null;
    return (
        <div className="mb-4">
            <h3 className={`text-${colorClass} mb-3 pb-2 border-bottom border-${colorClass} fw-bold fs-4`}>{title}</h3>
             <div className="card border-0 bg-light">
                 <div className="card-body py-3 px-3">
                     <p className="fs-5 mb-0">
                         {text}
                     </p>
                 </div>
             </div>
        </div>
    );
};

// **** REMOVED: renderMetadata function ****

// --- Main Component ---
const PaCstmResponse: React.FC<PaCstmResponseProps> = ({ analysisResult, isLoading }) => {

    if (isLoading) {
        return <Alert variant="info" className="mt-4 text-center"><Spinner animation="border" size="sm" className="me-2" />Loading analysis results...</Alert>;
    }

    if (!analysisResult) {
        return <Alert variant="secondary" className="mt-4">No analysis results to display.</Alert>;
    }

    // Handle top-level errors or structure issues
    // **** MODIFIED: Check only for analysis_results now ****
    if (!analysisResult.analysis_results) {
         const errorMsg = analysisResult.error || "Invalid analysis result structure received.";
         const details = analysisResult.details || JSON.stringify(analysisResult);
         return <Alert variant="danger" className="mt-4"><strong>Error:</strong> {errorMsg}<br/><strong>Details:</strong> <pre>{details}</pre></Alert>;
    }

    // **** REMOVED: metadata variable extraction ****
    // const metadata = analysisResult.analysis_metadata;
    const results = analysisResult.analysis_results;

    // Handle errors reported *within* the results structure
    if (results.status === 'failed' || results.status === 'skipped') {
        const errorTitle = results.status.charAt(0).toUpperCase() + results.status.slice(1);
        return (
            <Card className="mt-4 shadow-sm">
                <Card.Header className="bg-danger text-white py-3">
                    <h2 className="mb-0 fw-bold text-center fs-3">Analysis {errorTitle}</h2>
                </Card.Header>
                <Card.Body className="p-4">
                     {/* **** REMOVED: Metadata rendering in error case **** */}
                     {/* {metadata && renderMetadata(metadata)} */}
                     <Alert variant="danger" className="mt-3 fs-6">
                         <p className="mb-1"><strong>Status:</strong> {results.status.toUpperCase()}</p>
                         <p className="mb-1"><strong>Error:</strong> {results.error || 'Unknown error occurred in analysis.'}</p>
                         {results.details && <p className="mb-1"><strong>Details:</strong> {results.details}</p>}
                         {results.raw_response_preview && <p className="mb-0"><strong>AI Preview:</strong> {results.raw_response_preview}</p>}
                     </Alert>
                </Card.Body>
            </Card>
        );
    }

    // --- Render Successful Analysis ---
    return (
        <Card className="mt-4 shadow">
            <Card.Header className="bg-primary text-white py-3">
                {/* **** MODIFIED: Simplified heading **** */}
                <h2 className="mb-0 fw-bold text-center fs-3">
                    Customized Analysis Results
                </h2>
            </Card.Header>
            <Card.Body className="p-4">
                {/* **** REMOVED: Metadata Section Rendering **** */}
                {/* {metadata && renderMetadata(metadata)} */}

                {/* Analysis Results Sections - Calls updated to remove icon parameter */}
                {renderTextSection("Analysis Summary", results.analysis_summary, "dark")}
                {renderListSection("Success Factors", results.success_factors, "success")}
                {renderListSection("Recommendations", results.recommendations, "warning")}
                {renderRisksSection(results.risks)}
                {renderListSection("Trends", results.trends, "info")}
                {renderBudgetSection(results.budget_analysis)}
                {renderTextSection("Typical Implementation Timeline", results.typical_implementation_timeline, "primary")}
                {renderTextSection("Typical Duration", results.typical_duration, "primary")}
                {renderListSection("Potential Feedback Areas", results.potential_feedback_areas, "secondary")}

            </Card.Body>
        </Card>
    );
};

export default PaCstmResponse;