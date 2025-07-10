import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage users, assignments, and view analytics.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600">
          The admin dashboard is under development. You can use the API endpoints directly for now:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          <li>• GET /api/admin/dashboard - Dashboard statistics</li>
          <li>• GET /api/admin/users - User management</li>
          <li>• POST /api/admin/users - Create new users</li>
          <li>• POST /api/admin/bulk-assign - Bulk assign images</li>
          <li>• GET /api/admin/export/scores - Export data</li>
        </ul>
      </div>
    </div>
  );
} 