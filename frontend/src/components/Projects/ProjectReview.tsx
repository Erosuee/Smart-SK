import React, { useState, useEffect } from 'react';
import './ProjectReview.css';

// Update the Project interface to include proposerName
interface Project {
  id: number;
  referenceNumber: string;
  title: string;
  description: string;
  status: string;
  submittedDate: string;
  fileUrl?: string;
  fileName?: string;
  proposerName: string; // Add this new field
  userId: number;
}

interface ProjectReviewProps {
  userId: number;
}

// First, let's move the functions inside the component
const ProjectReview: React.FC<ProjectReviewProps> = ({ userId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<string>('approved');

  // Add these functions inside the component
  const handleCloseFileViewer = () => {
    setShowFileViewer(false);
    setViewingFileUrl('');
    setViewingFileName('');
  };

  const handleDownloadFile = async (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Extract the filename from the path
      const filenameParts = fileUrl.split('/');
      const filename = filenameParts[filenameParts.length - 1];
      
      // Make a request to the backend to download the file
      const response = await fetch(`http://localhost:3000/api/projects/download/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'project-document';
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download the file. Please try again.');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/projectreview/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', response.status, errorText);
        throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      // Debug each project to see username field
      if (data.projects && data.projects.length > 0) {
        data.projects.forEach((project: Project) => {
        });
      }
      
      if (data.success) {
        setProjects(data.projects);
      } else {
        throw new Error(data.message || 'Failed to fetch projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Failed to load projects. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (project: Project) => {
    setSelectedProject(project);
    setShowReviewModal(true);
    // Reset review form
    setReviewComment('');
    setReviewStatus('approved'); // Default to approved
  };

  const handleCloseModal = () => {
    setShowReviewModal(false);
    setSelectedProject(null);
  };

  // Update the handleViewFile function to display the PDF in a modal
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  
  // Add these state variables after your other useState declarations
  const [showFileViewer, setShowFileViewer] = useState<boolean>(false);
  const [viewingFileUrl, setViewingFileUrl] = useState<string>('');
  const [viewingFileName, setViewingFileName] = useState<string>('');
  
  // Update your handleViewFile function to set these variables
  // Update the handleViewFile function to match the project submission component
  const handleViewFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    
    try {
      // Extract just the filename from the path
      const filename = fileUrl.split(/[\/\\]/).pop();
      
      if (!filename) {
        alert('Invalid file path');
        return;
      }
      
      // Create a direct link to the file
      const fileViewUrl = `http://localhost:3000/api/projects/download/${filename}`;
      
      // Set the viewing file info and show the modal
      setViewingFileUrl(fileViewUrl);
      setViewingFileName(fileName || filename);
      setShowFileViewer(true);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Failed to view the file. Please try again.');
    }
  };

  // Replace the PDF modal section with this updated file viewer modal
  {showFileViewer && (
    <div className="modal-overlay">
      <div className="file-viewer-modal">
        <div className="file-viewer-header">
          <h3 className="file-viewer-title">{viewingFileName}</h3>
          <button className="file-viewer-close" onClick={handleCloseFileViewer}>×</button>
        </div>
        <div className="file-viewer-content">
          <iframe 
            className="file-viewer-iframe"
            src={viewingFileUrl}
            title="File Viewer"
            allowFullScreen
          ></iframe>
        </div>
        <div className="file-viewer-actions">
          <button 
            className="file-download-button"
            onClick={() => handleDownloadFile(viewingFileUrl, viewingFileName)}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )}
  
  // Add a function to close the PDF modal
  const handleClosePdfModal = () => {
    setShowPdfModal(false);
    setPdfUrl('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject) return;
    
    // Map the review decision to the database status
    let dbStatus = 'submitted'; // Default
    
    if (reviewStatus === 'approved') {
      dbStatus = 'approved';
    } else if (reviewStatus === 'revision') {
      dbStatus = 'revised';
    } else if (reviewStatus === 'denied') {
      dbStatus = 'denied';
    }
    
    try {
      const token = localStorage.getItem('token');

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
        }
      }
      
      // Try to get the reviewer name from various possible sources
      let reviewerName = 'Unknown Reviewer';
      
      // Check if we have a user object in localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.fullname) reviewerName = user.fullname;
          else if (user.fullName) reviewerName = user.fullName;
        } catch (e) {
          console.error('Error parsing user JSON:', e);
        }
      }
      
      // If still unknown, try direct keys
      if (reviewerName === 'Unknown Reviewer') {
        // Try all possible variations of the key name
        reviewerName = localStorage.getItem('fullname') || 
                       localStorage.getItem('fullName') || 
                       localStorage.getItem('name') ||
                       localStorage.getItem('username') ||
                       reviewerName;
      }
      
      // Hardcode the reviewer name for testing if still unknown
      if (reviewerName === 'Unknown Reviewer') {
        reviewerName = 'Luis Albert De Guzman'; // Use the name from your screenshot
      }

      // Update to use the correct endpoint
      const response = await fetch(`http://localhost:3000/api/projectreview/status/${selectedProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: dbStatus,
          remarks: reviewComment,
          reviewerName: reviewerName
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to update project status');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update the project in the local state
        setProjects(projects.map(project => 
          project.id === selectedProject.id 
            ? { ...project, status: dbStatus, remarks: reviewComment, reviewedBy: reviewerName } 
            : project
        ));
        
        // Close the modal
        handleCloseModal();
        
        // Show success message
        alert('Project review submitted successfully!');
        
        // Refresh the projects list
        fetchProjects();
      } else {
        throw new Error(data.message || 'Failed to update project status');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    }
  };

  return (
    <div className="project-review-container">
      <h3>Project Review</h3>
      <p>Review and evaluate submitted project proposals.</p>
      
      <div className="projects-table-container">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Reference Number</th>
              <th>Title & Description</th>
              <th>Proposer's Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="loading-message">Loading projects...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="error-message">{error}</td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-projects-message">No projects submitted yet.</td>
              </tr>
            ) : (
              projects.map(project => (
                <tr key={project.id}>
                  <td>{project.referenceNumber}</td>
                  <td>
                    <strong>{project.title}</strong>
                    <p className="project-description">{project.description}</p>
                  </td>
                  <td>{project.proposerName}</td>
                  <td>
                    <span className={`status-badge status-${project.status}`}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="review-button"
                      onClick={() => handleReviewClick(project)}
                    >
                      Review Proposal
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Review Modal */}
      {showReviewModal && selectedProject && (
        <div className="modal-overlay">
          <div className="modal-content review-modal">
            <div className="modal-header">
              <h3>Review Project Proposal</h3>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="project-details">
                <h4>{selectedProject.title}</h4>
                <p><strong>Reference:</strong> {selectedProject.referenceNumber}</p>
                <p><strong>Proposer:</strong> {selectedProject.proposerName}</p>
                <p><strong>Description:</strong> {selectedProject.description}</p>
                
                {selectedProject.fileUrl && (
                  <div className="project-file">
                    <p><strong>Attached Document:</strong> {selectedProject.fileName}</p>
                    <button 
                      className="view-file-btn"
                      onClick={() => handleViewFile(selectedProject.fileUrl)}
                    >
                      View Document
                    </button>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSubmitReview} className="review-form">
                <div className="form-group">
                  <label htmlFor="reviewStatus">Review Decision:</label>
                  <select 
                    id="reviewStatus" 
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    required
                  >
                    <option value="approved">Approved</option>
                    <option value="revision">Revision</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
                
                {/* Remarks field for reviewer feedback */}
                <div className="form-group">
                  <label htmlFor="reviewComment">Remarks:</label>
                  <textarea 
                    id="reviewComment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="Enter your review remarks here..."
                    required
                  ></textarea>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={handleCloseModal}>Cancel</button>
                  <button type="submit" className="submit-btn">Submit Review</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {showFileViewer && (
        <div className="modal-overlay">
          <div className="file-viewer-modal">
            <div className="file-viewer-header">
              <h3 className="file-viewer-title">{viewingFileName}</h3>
              <button className="file-viewer-close" onClick={handleCloseFileViewer}>×</button>
            </div>
            <div className="file-viewer-content">
              <iframe 
                className="file-viewer-iframe"
                src={viewingFileUrl}
                title="File Viewer"
                allowFullScreen
              ></iframe>
            </div>
            <div className="file-viewer-actions">
              <button 
                className="file-download-button"
                onClick={() => handleDownloadFile(viewingFileUrl, viewingFileName)}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectReview;
