import React from 'react';
import { useQuery } from 'react-query';
import { useApi } from '../hooks/useAuth';

export default function Analytics() {
  const api = useApi();

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery('adminAnalytics', api.getAnalytics);
  const analytics = analyticsData?.data?.analytics || {};

  if (analyticsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Scoring Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Score Distribution</h3>
          {analytics.scoreDistribution?.length > 0 ? (
            <ul className="space-y-2">
              {analytics.scoreDistribution.map((item) => (
                <li key={item.kss_score} className="flex justify-between items-center">
                  <span>KSS Score {item.kss_score}:</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No scoring data available.</p>
          )}
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Average Scores by User</h3>
          {analytics.averageByUser?.length > 0 ? (
            <ul className="space-y-2">
              {analytics.averageByUser.map((item) => (
                <li key={item.username} className="flex justify-between items-center">
                  <span>{item.username}:</span>
                  <span className="font-semibold">{item.avg_score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No scoring data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
