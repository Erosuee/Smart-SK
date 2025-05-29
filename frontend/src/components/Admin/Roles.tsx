import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Roles.css';

interface User {
  userID: number;
  fullName: string;
  position: string;
  barangay: string;
  roleName?: string;
}

interface Role {
  roleID: number;
  roleName: string;
  description: string;
}

const Roles: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch users and roles
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error('No authentication token found');
          navigate('/login', { replace: true });
          return;
        }
        
        // Fetch users with better error handling
        try {
          const usersResponse = await fetch('http://localhost:3000/api/roles/users', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!usersResponse.ok) {
            if (usersResponse.status === 401) {
              console.error('Authentication failed - redirecting to login');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/login', { replace: true });
              return;
            }
            
            const errorText = await usersResponse.text();
            console.error('Users response not OK:', errorText);
            throw new Error(`Failed to fetch users: ${usersResponse.status}`);
          }
          
          const usersData = await usersResponse.json();
          
          if (usersData.success) {
            setUsers(usersData.users);
          } else {
            throw new Error(usersData.message || 'Failed to fetch users');
          }
        } catch (userError) {
          console.error('Error fetching users:', userError);
        }
        
        try {
          const rolesResponse = await fetch('http://localhost:3000/api/roles/all', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!rolesResponse.ok) {
            const errorText = await rolesResponse.text();
            console.error('Roles response not OK:', errorText);
            throw new Error(`Failed to fetch roles: ${rolesResponse.status}`);
          }
            
          const rolesData = await rolesResponse.json();
          
          if (rolesData.success) {
            setRoles(rolesData.roles);
          } else {
            throw new Error(rolesData.message || 'Failed to fetch roles');
          }
        } catch (roleError) {
          console.error('Error fetching roles:', roleError);
        }
      } catch (error) {
        console.error('Error in fetchData:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setShowRoleModal(true);
    setEditMode(false);
    // Set the initial selected role based on user's current position
    setSelectedRole(user.position || '');
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setShowRoleModal(true);
    setEditMode(true);
    // Set the initial selected role based on user's current position
    setSelectedRole(user.position || '');
  };

  // Function to handle role selection from radio buttons
  const handleRoleSelection = (roleId: string, abbreviation: string) => {
    setSelectedRole(abbreviation);
    // Store the selected roleId for later assignment
  };

  // Update the handleRoleAssignment function to include the position (abbreviation)
  const handleRoleAssignment = async () => {
    if (!selectedUser || !selectedRole) return;
    
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        navigate('/login', { replace: true });
        return;
      }
      
      const response = await fetch('http://localhost:3000/api/roles/assignRole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedUser.userID,
          position: selectedRole // Store the abbreviation in the position column
        }),
      });
      
      if (response.ok) {
        // Success handling
        alert(`Role successfully ${editMode ? 'changed' : 'assigned'} to ${selectedUser.fullName}`);
        setShowRoleModal(false);
        setSelectedUser(null);
        
        // Fetch users and roles again to refresh the data
        const fetchData = async () => {
          setIsLoading(true);
          setError(null);
          
          try {
            // Fetch users with better error handling
            const usersResponse = await fetch('http://localhost:3000/api/roles/users', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!usersResponse.ok) {
              const errorText = await usersResponse.text();
              console.error('Users response not OK:', errorText);
              throw new Error(`Failed to fetch users: ${usersResponse.status}`);
            }
            
            const usersData = await usersResponse.json();
            
            if (usersData.success) {
              setUsers(usersData.users);
            } else {
              throw new Error(usersData.message || 'Failed to fetch users');
            }
            
            const rolesResponse = await fetch('http://localhost:3000/api/roles/all', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!rolesResponse.ok) {
              const errorText = await rolesResponse.text();
              console.error('Roles response not OK:', errorText);
              throw new Error(`Failed to fetch roles: ${rolesResponse.status}`);
            }
              
            const rolesData = await rolesResponse.json();
            
            if (rolesData.success) {
              setRoles(rolesData.roles);
            } else {
              throw new Error(rolesData.message || 'Failed to fetch roles');
            }
          } catch (error) {
            console.error('Error in fetchData:', error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      } else {
        // Error handling
        const errorData = await response.json();
        alert(errorData.message || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      alert('An error occurred while assigning the role');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="roles-container">
      <h3>User Role Management</h3>
      <p>Assign roles to users in the system.</p>
      
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Position</th>
              <th>Barangay</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4}>No users found</td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.userID}>
                  <td>{user.fullName}</td>
                  <td>{user.position || 'None'}</td>
                  <td>{user.barangay}</td>
                  <td>
                    {!user.position || !['MA', 'SKR', 'SKO'].includes(user.position) ? (
                      <button 
                        className="add-role-button"
                        onClick={() => handleAssignRole(user)}
                      >
                        Add Role
                      </button>
                    ) : (
                      <button 
                        className="change-role-button"
                        onClick={() => handleEditRole(user)}
                      >
                        Change Role
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {showRoleModal && (
        <div className="role-modal-overlay">
          <div className="role-modal">
            <h4>{editMode ? 'Change' : 'Assign'} Role to {selectedUser?.fullName}</h4>
            
            <div className="role-legend">
              <p>Select a Role:</p>
              <div className="role-legend-options">
                <div className="role-legend-option">
                  <input 
                    type="radio" 
                    id="MA" 
                    name="role" 
                    value="MA"
                    checked={selectedRole === 'MA'}
                    onChange={() => handleRoleSelection('1', 'MA')}
                  />
                  <label htmlFor="MA">
                    <span className="abbreviation">MA</span> - Master Admin
                  </label>
                </div>
                <div className="role-legend-option">
                  <input 
                    type="radio" 
                    id="SKR" 
                    name="role" 
                    value="SKR"
                    checked={selectedRole === 'SKR'}
                    onChange={() => handleRoleSelection('2', 'SKR')}
                  />
                  <label htmlFor="SKR">
                    <span className="abbreviation">SKR</span> - SK Reviewer
                  </label>
                </div>
                <div className="role-legend-option">
                  <input 
                    type="radio" 
                    id="SKO" 
                    name="role" 
                    value="SKO"
                    checked={selectedRole === 'SKO'}
                    onChange={() => handleRoleSelection('3', 'SKO')}
                  />
                  <label htmlFor="SKO">
                    <span className="abbreviation">SKO</span> - SK Officials
                  </label>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="assign-button"
                onClick={handleRoleAssignment}
                disabled={!selectedRole}
              >
                {editMode ? 'Change' : 'Assign'} Role
              </button>
              <button 
                className="close-modal-button"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                  setSelectedRole('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;