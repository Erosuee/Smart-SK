import React, { useState } from 'react';
import Layout from '../Layout/Layout';
import './Admin.css';

// Import the submodules
import LoginApproval from './LoginApproval';
import Roles from './Roles';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('loginApproval');

  return (
    <Layout>
      <div className="admin-container">
        <h2>Admin Dashboard</h2>
        
        <div className="admin-tabs">
          <button 
            className={activeTab === 'loginApproval' ? 'active' : ''} 
            onClick={() => setActiveTab('loginApproval')}
          >
            Login Approvals
          </button>
          <button 
            className={activeTab === 'roles' ? 'active' : ''} 
            onClick={() => setActiveTab('roles')}
          >
            Roles
          </button>
        </div>
        
        <div className="admin-content">
          {activeTab === 'loginApproval' && <LoginApproval />}
          {activeTab === 'roles' && <Roles />}
        </div>
      </div>
    </Layout>
  );
};

export default Admin;