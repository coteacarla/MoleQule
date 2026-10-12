import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHealth, saveCredentials, deleteCredentials, getCredentials, updateCredentials } from '../../api/endpoints';
import { useUIStore } from '../../store/uiStore';
import { showToast } from '../Shared/Toast';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const { activeUserId, setActiveUserId } = useUIStore();
  const queryClient = useQueryClient();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });

  // Automatically set active user from backend if not already set
  useEffect(() => {
    if (health?.credentials?.active_user && !activeUserId) {
      setActiveUserId(health.credentials.active_user);
    }
  }, [health, activeUserId, setActiveUserId]);

  const addCredentialsMutation = useMutation({
    mutationFn: saveCredentials,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      setShowAddDialog(false);
      // Set the newly added user as active
      if (data.user_id) {
        setActiveUserId(data.user_id);
      }
      showToast.success('Credentials added successfully');
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.error || 'Failed to add credentials');
    },
  });

  const updateCredentialsMutation = useMutation({
    mutationFn: updateCredentials,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      setEditingUser(null);
      if (data.user_id !== editingUser) {
        setActiveUserId(data.user_id);
      }
      showToast.success('Credentials updated successfully');
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.error || 'Failed to update credentials');
    },
  });

  const deleteCredentialsMutation = useMutation({
    mutationFn: deleteCredentials,
    onSuccess: (_, deletedUserId) => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      if (activeUserId === deletedUserId) {
        const remainingUsers = health?.credentials?.saved_users?.filter(u => u !== deletedUserId) || [];
        if (remainingUsers.length > 0) {
          setActiveUserId(remainingUsers[0]);
        } else {
          // No users left, clear active user
          setActiveUserId('');
        }
      }
      showToast.success('User deleted successfully');
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.error || 'Failed to delete user');
    },
  });

  const handleSwitchUser = (userId: string) => {
    setActiveUserId(userId);
    setIsOpen(false);
    showToast.success(`Switched to user: ${userId}`);
  };

  const handleEdit = (userId: string) => {
    setEditingUser(userId);
    setIsOpen(false);
  };

  const handleDelete = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete user "${userId}" and their credentials?`)) {
      deleteCredentialsMutation.mutate(userId);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-white flex items-center justify-center text-xl font-bold hover:opacity-80 transition-all"
        title={`Active user: ${activeUserId}`}
        aria-label="User menu"
      >
        {/* Use an inline SVG so color is controlled via CSS (emoji glyphs are rendered as color images and won't inherit text color) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.6 0-10.8 1.8-10.8 5.4v1.8h21.6v-1.8c0-3.6-7.2-5.4-10.8-5.4z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute top-14 right-0 w-72 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-2xl z-50 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750 flex-shrink-0">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Active User</p>
              <p className="font-bold text-primary-400 text-lg mt-1 truncate" title={activeUserId}>
                {activeUserId || 'No user selected'}
              </p>
            </div>

            <div className="p-2 overflow-y-auto flex-1">
              <p className="text-xs text-gray-400 px-2 py-1 uppercase tracking-wide">Saved Users</p>
              {health?.credentials?.saved_users && health.credentials.saved_users.length > 0 ? (
                health.credentials.saved_users.map((userId) => (
                  <div
                    key={userId}
                    className={`group rounded-lg mb-1 transition-all ${
                      userId === activeUserId ? 'bg-green-500/30 border-2 border-green-600 shadow-lg' : 'hover:bg-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => handleSwitchUser(userId)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 ${userId === activeUserId ? 'font-bold text-green-200' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {userId === activeUserId && (
                          <span className="text-green-400 text-sm flex-shrink-0">✓</span>
                        )}
                        <span className={`truncate ${userId === activeUserId ? 'text-green-300 font-bold' : 'text-gray-200'}`} title={userId}>
                          {userId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(userId);
                          }}
                          className="px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                          title="Edit user"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(userId, e)}
                          className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                          title="Delete user"
                        >
                          Del
                        </button>
                      </div>
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm px-3 py-2 italic">No users configured</p>
              )}
            </div>

            <div className="p-2 border-t border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setShowAddDialog(true);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all font-bold shadow-lg flex items-center justify-center gap-2 border-2 border-green-700"
              >
                <span className="text-lg">+</span>
                <span>Add User</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Credentials Dialog */}
      {showAddDialog && (
        <AddCredentialsDialog
          onClose={() => setShowAddDialog(false)}
          onSave={(data) => addCredentialsMutation.mutate(data)}
          isLoading={addCredentialsMutation.isPending}
        />
      )}

      {/* Edit Credentials Dialog */}
      {editingUser && (
        <EditCredentialsDialog
          userId={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(data) => updateCredentialsMutation.mutate(data)}
          isLoading={updateCredentialsMutation.isPending}
        />
      )}
    </div>
  );
};


// Add Credentials Dialog Component
interface AddCredentialsDialogProps {
  onClose: () => void;
  onSave: (data: { user_id: string; token: string; crn: string }) => void;
  isLoading: boolean;
}

const AddCredentialsDialog: React.FC<AddCredentialsDialogProps> = ({
  onClose,
  onSave,
  isLoading,
}) => {
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [crn, setCrn] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !token.trim() || !crn.trim()) {
      showToast.error('All fields are required');
      return;
    }
    onSave({ user_id: userId.trim(), token: token.trim(), crn: crn.trim() });
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl my-auto">
        <h2 className="text-2xl font-bold mb-4 text-primary-400">Add New User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5 text-gray-300 font-medium">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="IBMid-XXXXXXXXXX"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-gray-300 font-medium">IBM API Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter IBM Quantum API token"
                className="w-full px-3 py-2.5 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-gray-300 font-medium">IBM Cloud CRN</label>
            <input
              type="text"
              value={crn}
              onChange={(e) => setCrn(e.target.value)}
              placeholder="crn:v1:bluemix:public:quantum-computing:..."
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition-all font-bold shadow-lg disabled:cursor-not-allowed border-2 border-green-700"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    modalRoot
  );
};

// Edit Credentials Dialog Component
interface EditCredentialsDialogProps {
  userId: string;
  onClose: () => void;
  onSave: (data: { old_user_id: string; new_user_id?: string; crn?: string }) => void;
  isLoading: boolean;
}

const EditCredentialsDialog: React.FC<EditCredentialsDialogProps> = ({
  userId,
  onClose,
  onSave,
  isLoading,
}) => {
  const [newUserId, setNewUserId] = useState(userId);
  const [crn, setCrn] = useState('');
  const [isLoadingCreds, setIsLoadingCreds] = useState(true);

  // Load existing credentials
  React.useEffect(() => {
    getCredentials(userId)
      .then((data) => {
        setCrn(data.crn || '');
        setIsLoadingCreds(false);
      })
      .catch(() => {
        showToast.error('Failed to load user data');
        setIsLoadingCreds(false);
      });
  }, [userId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: { old_user_id: string; new_user_id?: string; crn?: string } = {
      old_user_id: userId,
    };
    
    if (newUserId !== userId) {
      updates.new_user_id = newUserId.trim();
    }
    
    if (crn.trim()) {
      updates.crn = crn.trim();
    }

    onSave(updates);
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl my-auto">
        <h2 className="text-2xl font-bold mb-4 text-primary-400">Edit User</h2>
        {isLoadingCreds ? (
          <div className="py-8 text-center text-gray-400">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5 text-gray-300 font-medium">User ID</label>
              <input
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-gray-300 font-medium">IBM Cloud CRN</label>
              <input
                type="text"
                value={crn}
                onChange={(e) => setCrn(e.target.value)}
                placeholder="crn:v1:bluemix:public:quantum-computing:..."
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300">
                <strong>Note:</strong> IBM API Token cannot be edited for security reasons. To change the token, please delete this user and create a new one.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition-all font-medium shadow-md disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    modalRoot
  );
};
