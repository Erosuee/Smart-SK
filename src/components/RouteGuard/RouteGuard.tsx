import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface RouteGuardProps {
  requiredRole?: string;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ requiredRole }) => {
  // Check if user is logged in
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = userData.role || '';
  
  // If user is not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // If a specific role is required and user doesn't have it, redirect to dashboard
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // If all checks pass, render the protected route
  return <Outlet />;
};

export default RouteGuard;