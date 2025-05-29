import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaBars } from 'react-icons/fa';
import './Sidebar.css';

interface SidebarProps {
  collapsed?: boolean;
  toggleSidebar?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed: propCollapsed = false,
  toggleSidebar: propToggleSidebar
}) => {
  // Use local state if no prop is provided
  const [localCollapsed, setLocalCollapsed] = useState(propCollapsed);
  
  // Determine if we're using props or local state
  const collapsed = propToggleSidebar ? propCollapsed : localCollapsed;
  
  const toggleSidebar = () => {
    if (propToggleSidebar) {
      propToggleSidebar();
    } else {
      setLocalCollapsed(!localCollapsed);
    }
  };
  
  const { user, logout } = useAuth();
  const location = useLocation();

  // Function to check if a menu item is active
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Function to check if user is admin
  const isAdmin = () => {
    // Only show admin link if user position is "MA" (Master Admin)
    return user?.position === 'MA';
  };

  // Handle logout with token expiration
  const handleLogout = async () => {
    try {
      // Get the token before logout clears it
      const token = localStorage.getItem('token');
      
      // Call the backend to update the expires_at field
      if (token) {
        await fetch('http://localhost:3000/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            userId: user?.id,
            setExpiration: true 
          })
        });
      }
      
      // Then perform the regular logout
      logout();
    } catch (error) {
      console.error('Error during logout:', error);
      // Still perform logout even if the API call fails
      logout();
    }
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="header-content">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <FaBars />
          </button>
          {!collapsed && <h2>Smart SK</h2>}
        </div>
      </div>
      
      {!collapsed && (
        <>
          <div className="user-info">
            <div className="user-name">{user?.fullname || user?.username || 'User'}</div>
            <div className="user-role">{user?.position || 'User'}</div>
          </div>
          
          <nav className="sidebar-nav">
            <ul>
              <li className={isActive('/dashboard') ? 'active' : ''}>
                <Link to="/dashboard" title="Dashboard">
                  Dashboard
                </Link>
              </li>
              
              {/* Show admin link only for admin users */}
              {isAdmin() && (
                <li className={isActive('/admin') ? 'active' : ''}>
                  <Link to="/admin" title="Admin">
                    Admin
                  </Link>
                </li>
              )}
              
              <li className={isActive('/projects') ? 'active' : ''}>
                <Link to="/projects" title="Projects">
                  Projects
                </Link>
              </li>

              <li className={isActive('/budget') ? 'active' : ''}>
                <Link to="/budget" title="SK Annual Budget">
                  SK Annual Budget
                </Link>
              </li>
              
              <li className={isActive('/predictive-analytics') ? 'active' : ''}>
                <Link to="/predictive-analytics" title="Predictive Project Analysis">
                  Predictive Project Analysis
                </Link>
              </li>
              
              <li className={isActive('/forecast') ? 'active' : ''}>
                <Link to="/forecast" title="Project Forecasting">
                  Project Forecasting
                </Link>
              </li>
            </ul>
          </nav>
          
          <div className="sidebar-footer">
            <button className="logout-button" onClick={handleLogout} title="Logout">
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;