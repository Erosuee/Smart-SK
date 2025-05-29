import React, { useState, useEffect } from 'react';
import './ProjectSubmission.css';

// Update the Project interface to use the correct status values
interface Project {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  status: 'submitted' | 'revised' | 'approved' | 'denied';
  submittedDate: string;
  fileUrl?: string;
  fileName?: string;
  remarks?: string;
  reviewedBy?: string; // Add this field
}

interface ProjectSubmissionProps {
  userId?: number;
}

const ProjectSubmission: React.FC<ProjectSubmissionProps> = ({ userId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Form state
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [projectFile, setProjectFile] = useState<File | null>(null);
  
  // Track progress state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // File viewer state
  const [showFileViewer, setShowFileViewer] = useState<boolean>(false);
  const [viewingFileUrl, setViewingFileUrl] = useState<string>('');
  const [viewingFileName, setViewingFileName] = useState<string>('');
  
  // Add these state variables for the remarks modal
  const [showRemarksModal, setShowRemarksModal] = useState<boolean>(false);
  const [selectedRemarks, setSelectedRemarks] = useState<string>('');
  const [selectedProjectTitle, setSelectedProjectTitle] = useState<string>('');
  const [selectedReviewedBy, setSelectedReviewedBy] = useState<string>('');

  // Add this function to handle opening the remarks modal
  const handleViewRemarks = (project: Project) => {
    setSelectedRemarks(project.remarks || 'No remarks provided');
    setSelectedProjectTitle(project.title);
    // Check if reviewedBy exists and is not null/empty before using it
    setSelectedReviewedBy(project.reviewedBy && project.reviewedBy !== 'null' ? project.reviewedBy : 'Not yet reviewed');
    setShowRemarksModal(true);
  };
  
  // Update the close function to reset the reviewer name
  const handleCloseRemarksModal = () => {
    setShowRemarksModal(false);
    setSelectedRemarks('');
    setSelectedProjectTitle('');
    setSelectedReviewedBy(''); // Add this line
  };
  
  useEffect(() => {
    // Fetch user's projects when component mounts
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        // Get userId from props first, then try localStorage
        const currentUserId = userId || localStorage.getItem('userId');
        
        // Try to extract userId from token if not found in props or localStorage
        if (!currentUserId && token) {
          try {
            // Decode JWT token to get userId
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              if (payload.userId) {
                // Use userId from token
                const response = await fetch(`http://localhost:3000/api/projects/user/${payload.userId}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                
                // Continue with response handling...
                if (!response.ok) {
                  throw new Error(`Server responded with status: ${response.status}`);
                }
                
                const responseText = await response.text();
                
                let data;
                try {
                  data = JSON.parse(responseText);
                } catch (parseError) {
                  console.error('Error parsing response:', parseError);
                  throw new Error('Invalid response format from server');
                }
                
                if (data.success) {
                  const projectsArray = Array.isArray(data.projects) ? data.projects : [];
                  setProjects(projectsArray);
                  setError(null);
                } else {
                  throw new Error(data.message || 'Failed to fetch projects');
                }
                
                setLoading(false);
                return;
              }
            }
          } catch (tokenError) {
            console.error('Error decoding token:', tokenError);
          }
        }
        
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setLoading(false);
          return;
        }
        
        if (!currentUserId) {
          setError('User ID not found. Please log in again.');
          setLoading(false);
          return;
        }
      
      try {
        // Convert userId to number if it's a string from localStorage
        const userIdValue = typeof currentUserId === 'string' ? parseInt(currentUserId, 10) : currentUserId;
        
        const response = await fetch(`http://localhost:3000/api/projects/user/${userIdValue}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Check if response is ok before trying to parse it
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        // Log the full response for debugging
        const responseText = await response.text();
        
        // Parse the response text back to JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          throw new Error('Invalid response format from server');
        }
        
        if (data.success) {
          // Make sure projects is always an array
          const projectsArray = Array.isArray(data.projects) ? data.projects : [];
          setProjects(projectsArray);
          setError(null); // Clear any previous errors
        } else {
          throw new Error(data.message || 'Failed to fetch projects');
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        setError('Failed to load projects. Please try again later.');
      }
    } catch (error) {
      console.error('Error in fetchProjects:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  fetchProjects();
}, [userId]);

const handleSubmitClick = () => {
  setShowSubmitForm(true);
};

const handleCloseForm = () => {
  setShowSubmitForm(false);
  setProjectTitle('');
  setProjectDescription('');
  setProjectFile(null);
  setUploadProgress(0);
};

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files.length > 0) {
    setProjectFile(e.target.files[0]);
  }
};

const handleSubmitProject = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!projectTitle || !projectDescription) {
    alert('Please fill in all required fields');
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    // Get userId from token if not provided in props
    let userIdToSubmit = userId;
    if (!userIdToSubmit) {
      const tokenParts = token?.split('.');
      if (tokenParts && tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        userIdToSubmit = payload.userId;
      }
    }
    
    if (!userIdToSubmit) {
      alert('User ID not found. Please log in again.');
      return;
    }
    
    // Create form data to handle file upload
    const formData = new FormData();
    formData.append('title', projectTitle);
    formData.append('description', projectDescription);
    formData.append('userId', userIdToSubmit.toString());
    
    if (projectFile) {
      formData.append('projectFile', projectFile);
    }
    
    // Create XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress);
      }
    });
    
    xhr.open('POST', 'http://localhost:3000/api/projects/submit');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
    xhr.onload = function() {
      if (xhr.status === 200 || xhr.status === 201) {
        const data = JSON.parse(xhr.responseText);
        
        if (data.success) {
          // Add the new project to the list
          const newProject: Project = {
            id: data.project.id,
            referenceNumber: data.project.referenceNumber,
            title: projectTitle,
            description: projectDescription,
            status: 'submitted',
            submittedDate: new Date().toISOString(),
            fileUrl: data.project.fileUrl,
            fileName: projectFile?.name
          };
          
          setProjects([...projects, newProject]);
          setSelectedProject(newProject);
          setCurrentStep(1); // Set to "Project Submitted" step
          handleCloseForm();
        } else {
          alert(data.message || 'Failed to submit project');
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          alert(errorData.message || 'Failed to submit project. Please try again.');
        } catch (e) {
          alert('Failed to submit project. Please try again.');
        }
      }
    };
    
    xhr.onerror = function() {
      alert('An error occurred while submitting your project. Please try again.');
    };
    
    xhr.send(formData);
  } catch (err) {
    console.error('Error submitting project:', err);
    alert('An error occurred while submitting your project. Please try again.');
  }
};

const handleSelectProject = (project: Project) => {
  setSelectedProject(project);
  
  // Set the current step based on project status
  switch (project.status) {
    case 'submitted':
      setCurrentStep(1);
      break;
    case 'revised':
      setCurrentStep(2);
      break;
    case 'approved':
      setCurrentStep(3);
      break;
    case 'denied':
      setCurrentStep(3);
      break;
    default:
      setCurrentStep(1);
  }
};
  
  //File Viewer Logic
  const handleViewFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    
    try {
      // Extract just the filename from the path
      const filename = fileUrl.split(/[\/\\]/).pop();
      
      if (!filename) {
        alert('Invalid file path');
        return;
      }
      
      // Create a direct link to the file without token
      const fileViewUrl = `http://localhost:3000/api/projects/download/${filename}`;
      
      // For modal viewing
      setViewingFileUrl(fileViewUrl);
      setViewingFileName(fileName || filename);
      setShowFileViewer(true);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Failed to view the file. Please try again.');
    }
  };
  
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
  
  return (
    <div className="project-submission-container">
      <h3>Project Submissions</h3>
      <p>Track and manage submitted projects.</p>
      
      <div className="project-actions">
        <button className="submit-project-btn" onClick={handleSubmitClick}>
          Submit New Project
        </button>
      </div>
      
      <div className="projects-table-container">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Reference Number</th>
              <th>Details</th>
              <th>Status</th>
              <th>Documents</th>
              <th>Remarks</th>
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
                  <td>
                    <span className={`status-badge status-${project.status}`}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                    {project.status !== 'submitted' && (
                      <div className="reviewer-name">
                        {project.reviewedBy && project.reviewedBy !== 'null' ? `By: ${project.reviewedBy}` : 'Not yet reviewed'}
                      </div>
                    )}
                  </td>
                  <td>
                    {project.fileUrl && (
                      <button 
                        className="view-file-btn"
                        onClick={() => handleViewFile(project.fileUrl, project.fileName)}
                      >
                        View File
                      </button>
                    )}
                  </td>
                  <td>
                    {project.remarks ? (
                      <button 
                        className="view-remarks-btn"
                        onClick={() => handleViewRemarks(project)}
                      >
                        View Remarks
                      </button>
                    ) : (
                      <span className="no-remarks">No remarks</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {showSubmitForm && (
        <div className="modal-overlay">
          <div className="modal-content project-form-modal">
            <div className="modal-header">
              <h3>Submit New Project</h3>
              <button className="close-btn" onClick={handleCloseForm}>×</button>
            </div>
            <form onSubmit={handleSubmitProject}>
              <div className="form-group">
                <label htmlFor="projectTitle">Project Title</label>
                <input
                  type="text"
                  id="projectTitle"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Enter project title"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="projectDescription">Project Description</label>
                <textarea
                  id="projectDescription"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe your project in detail"
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="projectFile">Project Document (PDF, DOC, DOCX)</label>
                <div className="file-input-container">
                  <input
                    type="file"
                    id="projectFile"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                    className="file-input"
                  />
                  <label htmlFor="projectFile" className="file-input-label">
                    {projectFile ? projectFile.name : 'Choose File'}
                  </label>
                </div>
                <p className="file-help">Upload project documentation, proposals, or any supporting documents.</p>
              </div>
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{uploadProgress}% Uploaded</span>
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={handleCloseForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Submit Project
                </button>
              </div>
            </form>
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
      
      {/* Remarks modal */}
      {showRemarksModal && (
        <div className="modal-overlay">
          <div className="modal-content remarks-modal">
            <div className="modal-header">
              <h3>Reviewer Remarks</h3>
              <button className="close-btn" onClick={handleCloseRemarksModal}>×</button>
            </div>
            <div className="modal-body">
              <h4>{selectedProjectTitle}</h4>
              <div className="remarks-content">
                <p>{selectedRemarks}</p>
                {selectedReviewedBy && selectedReviewedBy !== 'null' ? (
                  <p className="reviewer-info">Reviewed By: {selectedReviewedBy}</p>
                ) : (
                  <p className="reviewer-info">Not yet reviewed</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSubmission;