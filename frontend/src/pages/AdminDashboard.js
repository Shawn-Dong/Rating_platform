import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import ImageUpload from '../components/ImageUpload';
import ImageList from '../components/ImageList';
import Analytics from '../components/Analytics';
import BulkAssignment from '../components/BulkAssignment';

function UserManagement() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: usersData, isLoading: usersLoading } = useQuery('adminUsers', api.getUsers);
  const users = usersData?.data?.users || [];

  const updateUserStatusMutation = useMutation(
    ({ userId, isActive }) => api.updateUserStatus(userId, isActive),
    {
      onSuccess: () => {
        toast.success('User status updated successfully');
        queryClient.invalidateQueries('adminUsers');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update user status');
      },
    }
  );

  const handleStatusToggle = (userId, currentStatus) => {
    updateUserStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  if (usersLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">User Management</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleStatusToggle(user.id, user.is_active)}
                    disabled={updateUserStatusMutation.isLoading}
                    className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage users, assignments, and view analytics.
        </p>
      </div>
      
      <div className="space-y-8">
        <BulkAssignment />
        <Analytics />
        <ImageUpload />
        <ImageList />
        <UserManagement />
        {/* Other admin components will go here */}
      </div>
    </div>
  );
} 