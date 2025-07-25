import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi, useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const api = useApi();
  const { user } = useAuth();
  
  const { data: progressData, isLoading: progressLoading } = useQuery('progress', api.getProgress);
  const { data: scoresData, isLoading: scoresLoading } = useQuery('myScores', api.getMyScores);

  const progress = progressData?.data?.progress;
  const recentScores = scoresData?.data?.scores?.slice(0, 5) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.guest_name || user?.username}!
        </h1>
        <p className="mt-2 text-gray-600">
          {user?.role === 'guest' 
            ? `Hi ${user.guest_name}, you can start scoring images below.`
            : 'Track your progress and continue scoring images.'
          }
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {progressLoading ? '...' : progress?.total_assigned || 0}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Assigned Images</h3>
              <p className="text-sm text-gray-600">Total images to score</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {progressLoading ? '...' : progress?.completed || 0}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Completed</h3>
              <p className="text-sm text-gray-600">Images you've scored</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {progressLoading ? '...' : progress?.remaining || 0}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Remaining</h3>
              <p className="text-sm text-gray-600">Images left to score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Progress</h2>
            <span className="text-sm text-gray-600">
              {progress.completion_percentage}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress.completion_percentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {progress.completed} of {progress.total_assigned} images completed
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-4">
            <Link
              to="/score"
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {progress?.remaining > 0 ? 'Continue Scoring Images' : 'Start Scoring'}
            </Link>
            
            {progress?.remaining === 0 && progress?.completed > 0 && (
              <div className="text-center p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="text-green-600 text-2xl mb-2">✓</div>
                <h3 className="text-lg font-medium text-green-800">All Done!</h3>
                <p className="text-green-600">
                  You've completed all your assigned images. Great work!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Scores */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Scores</h2>
          {scoresLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : recentScores.length > 0 ? (
            <div className="space-y-3">
              {recentScores.map((score) => (
                <div key={score.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user?.role === 'guest' ? 'Image' : (score.filename || score.original_name)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(score.scored_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      KSS: {score.kss_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No scores yet. Start by scoring some images!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 