import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './LoginApproval.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PendingUser {
  userID: number;
  userName: string;
  fullName: string;
  position: string;
  barangay: string;
  emailAddress: string;
  phoneNumber: string;
}

const LoginApproval: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // First useEffect to check authentication only once
  useEffect(() => {
    // Only check auth once to prevent infinite loops
    if (!authChecked) {
      // Check if user has admin position
      if (!user) {
        navigate('/login', { replace: true });
      } else if (user.position !== 'MA') {
        navigate('/unauthorized', { replace: true });
      } else {
        // User is authenticated and has proper position
        fetchPendingUsers();
      }
      setAuthChecked(true);
    }
  }, [user, navigate, authChecked]);

  // Update the fetchPendingUsers function to better handle authentication errors
  const fetchPendingUsers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (!token) {
        console.error('No authentication token found');
        navigate('/login', { replace: true });
        return;
      }
      
      try {
        const response = await fetch('http://localhost:3000/api/loginapproval/pending', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.error('Authentication failed - token might be invalid');
            // Don't redirect to login immediately, check if token is actually invalid
            const tokenCheckResponse = await fetch('http://localhost:3000/api/auth/verify', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!tokenCheckResponse.ok) {
              // Token is invalid, redirect to login
              console.error('Token verification failed - redirecting to login');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/login', { replace: true });
            } else {
              // Token is valid but user doesn't have permission, show unauthorized page
              console.error('Token is valid but user lacks permission');
              navigate('/unauthorized', { replace: true });
            }
            return;
          }
          throw new Error(`Failed to fetch pending users: ${response.status}`);
        }
        
        const data = await response.json();
        setPendingUsers(data.pendingApprovals || []);
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Server might be down.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      setError('Error loading data. Please check if the backend server is running and accessible.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userID: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/loginapproval/approve/${userID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Make sure we're using the exact parameter name expected by the stored procedure
        body: JSON.stringify({ PendingUserID: userID })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('User approved successfully!');
        // Remove the approved user from the list
        setPendingUsers(pendingUsers.filter(user => user.userID !== userID));
      } else {
        toast.error(data.message || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('An error occurred while approving the user');
    }
  };

  // Update the handleReject function to include a reason
  const handleReject = async (userID: number) => {
    try {
    // Prompt for rejection reason (optional)
    const reason = window.prompt('Please provide a reason for rejection (optional):');
    
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:3000/api/loginapproval/reject/${userID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      toast.success('User rejected successfully!');
      // Remove the rejected user from the list
      setPendingUsers(pendingUsers.filter(user => user.userID !== userID));
    } else {
      toast.error(data.message || 'Failed to reject user');
    }
  } catch (error) {
    console.error('Error rejecting user:', error);
    toast.error('An error occurred while rejecting the user');
  }
};

  if (isLoading) {
    return <div className="loading">Loading pending approvals...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="login-approval-container">
      <h3>Login Approval</h3>
      <p>Review and approve new user registration requests.</p>
      
      {pendingUsers.length === 0 ? (
        <div className="no-approvals">
          <p>No pending approval requests.</p>
        </div>
      ) : (
        <div className="approval-list">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Position</th>
                <th>Barangay</th>
                <th>Contact Number</th>
                <th>Email Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map(user => (
                <tr key={user.userID}>
                  <td>{user.fullName}</td>
                  <td>{user.position}</td>
                  <td>{user.barangay}</td>
                  <td>{user.phoneNumber}</td>
                  <td>{user.emailAddress}</td>
                  <td className="action-buttons">
                    <button 
                      className="approve-button"
                      onClick={() => handleApprove(user.userID)}
                    >
                      Approve
                    </button>
                    <button 
                      className="reject-button"
                      onClick={() => handleReject(user.userID)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default LoginApproval;