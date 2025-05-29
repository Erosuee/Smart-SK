import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../Layout/Layout';
import './Projects.css';

// Import existing submodules with correct paths
import ProjectSubmission from './ProjectSubmission';
import ProjectReview from './ProjectReview';

const Projects: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projectList');

  // Function to check if user can access project review
  const canAccessProjectReview = () => {
    // Only MA (Master Admin) and SKR (SK Reviewer) can access project review
    return user?.position === 'MA' || user?.position === 'SKR';
  };

  useEffect(() => {
    // Check if user is logged in
    if (!user) {
      navigate('/login', { replace: true });
    }
    
    // If user can't access project review and that tab is active, switch to project list
    if (!canAccessProjectReview() && activeTab === 'projectReview') {
      setActiveTab('projectList');
    }
  }, [user, navigate, activeTab]);

  return (
    <Layout>
      <div className="projects-container">
        <h2>Projects</h2>
        
        <div className="projects-tabs">
          <button 
            className={activeTab === 'projectList' ? 'active' : ''} 
            onClick={() => setActiveTab('projectList')}
          >
            Project List
          </button>
          
          {/* Only show Project Review tab for MA and SKR users */}
          {canAccessProjectReview() && (
            <button 
              className={activeTab === 'projectReview' ? 'active' : ''} 
              onClick={() => setActiveTab('projectReview')}
            >
              Project Review
            </button>
          )}
        </div>
        
        <div className="projects-content">
          {activeTab === 'projectList' && <ProjectSubmission />}
          {activeTab === 'projectReview' && canAccessProjectReview() && user && user.id !== undefined && (
            <ProjectReview userId={user.id} />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Projects;