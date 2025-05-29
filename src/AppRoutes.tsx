import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Projects from './components/Projects/Projects';
import Admin from './components/Admin/Admin';
import Unauthorized from './components/Unauthorized/Unauthorized';
import ForgotPassword from './components/ForgotPassword/ForgotPassword';
import Register from './components/Register/Register';
import Forecast from './components/Forecast/Forecast';
import Predictive from './components/PredictiveAnalysis/pa';

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading indicator while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/forecast" element={<Forecast />} />
      <Route path="/predictive-analytics" element={<Predictive />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/projects" element={user ? <Projects /> : <Navigate to="/login" />} />
      
      {/* Admin route - bypass all checks */}
      <Route path="/admin" element={<Admin />} />
      
      {/* Default route */}
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
};

export default AppRoutes;