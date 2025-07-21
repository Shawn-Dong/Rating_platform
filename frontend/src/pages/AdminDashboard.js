import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import ImageUpload from '../components/ImageUpload';
import ImageList from '../components/ImageList';
import Analytics from '../components/Analytics';
import BulkAssignment from '../components/BulkAssignment';
import ExportPanel from '../components/ExportPanel';

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

function Overview() {
  const api = useApi();
  const { data: statsData, isLoading: statsLoading } = useQuery('adminDashboardStats', api.getDashboardStats);
  const statistics = statsData?.data?.statistics || {};

  if (statsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading overview...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
        <p className="mt-1 text-3xl font-bold text-gray-900">{statistics.users}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900">Total Scorers</h3>
        <p className="mt-1 text-3xl font-bold text-gray-900">{statistics.scorers}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900">Total Images</h3>
        <p className="mt-1 text-3xl font-bold text-gray-900">{statistics.images}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900">Total Scores</h3>
        <p className="mt-1 text-3xl font-bold text-gray-900">{statistics.scores}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900">Assignments Completion</h3>
        <p className="mt-1 text-3xl font-bold text-gray-900">{statistics.completion_rate}%</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', name: 'Overview', component: <Overview /> },
    { id: 'users', name: 'User Management', component: <UserManagement /> },
    { id: 'images', name: 'Image Management', component: <>
        <ImageUpload />
        <ImageList />
      </> },
    { id: 'assign', name: 'Bulk Assignment', component: <BulkAssignment /> },
    { id: 'analytics', name: 'Analytics', component: <Analytics /> },
    { id: 'export', name: 'Data Export', component: <ExportPanel /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage users, assignments, and view analytics.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              `}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-8 space-y-8">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
} 