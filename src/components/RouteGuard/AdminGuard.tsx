import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';

const AdminGuard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // First, check localStorage for user role
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const userRole = userData.role || '';
        
        // If we can determine from localStorage that user is admin, use that
        if (userRole === 'MA') {
          setIsAdmin(true);
          setLoading(false);
          return;
        }
        
        // Otherwise try to verify with backend
        const token = localStorage.getItem('token');
        
        if (!token) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Try to verify admin status with the backend
        try {
          const response = await axios.get('http://localhost:3175/api/check-admin', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000 // Add timeout to prevent long waiting
          });
          
          setIsAdmin(response.data.isAdmin);
        } catch (apiError) {
          console.error('Error checking admin status:', apiError);
          // If API call fails, fall back to localStorage check
          // We already checked if userRole is 'MA' above, so here we know it's not
          setIsAdmin(false);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error in admin guard:', error);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (loading) {
    // You could return a loading spinner here
    return <div>Loading...</div>;
  }

  // If user is not an admin, redirect to dashboard
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is admin, render the protected route
  return <Outlet />;
};

export default AdminGuard;