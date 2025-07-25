import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useApi } from '../hooks/useAuth';

function ImageScoreDetails({ imageId, isOpen, onClose }) {
  const api = useApi();
  const { data: imageData, isLoading, error } = useQuery(
    ['imageScores', imageId], 
    () => api.getImageScores(imageId),
    { enabled: isOpen }
  );



  if (!isOpen) return null;

  const image = imageData?.data?.image;
  const scores = imageData?.data?.individual_scores || [];
  const stats = imageData?.data?.statistics;

  return (
    <tr>
      <td colSpan="6" className="px-6 py-4 bg-gray-50">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold text-gray-900">Individual Ratings</h4>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error ? (
            <div className="text-center py-8 text-red-500">
              <p>Error loading scores: {error.response?.data?.error || error.message}</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading scores...</p>
            </div>
          ) : scores.length > 0 ? (
            <>
              {/* Statistics Summary */}
              {stats && (
                <div className="bg-white rounded-lg border p-4 mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">Scoring Summary</h5>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Scores:</span>
                      <span className="ml-2 font-semibold">{stats.total_scores}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Average:</span>
                      <span className="ml-2 font-semibold">{stats.avg_score?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Range:</span>
                      <span className="ml-2 font-semibold">{stats.min_score} - {stats.max_score}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Variance:</span>
                      <span className="ml-2 font-semibold">{stats.max_score - stats.min_score}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Scores */}
              <div className="space-y-3">
                {scores.map((score, index) => (
                  <div key={score.score_id} className="bg-white rounded-lg border p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <h6 className="font-medium text-gray-900">{score.scorer_username}</h6>
                        <p className="text-sm text-gray-600">
                          Scored: {new Date(score.scored_at).toLocaleDateString()}
                        </p>
                        {score.time_spent_seconds && (
                          <p className="text-xs text-gray-500">
                            Time: {Math.round(score.time_spent_seconds / 60)}m {score.time_spent_seconds % 60}s
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          KSS Score: {score.kss_score}
                        </span>
                      </div>
                      
                      <div className="md:col-span-2">
                        <div className="space-y-2">
                          <div>
                            <h6 className="text-sm font-medium text-gray-900">Explanation:</h6>
                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              {score.explanation}
                            </p>
                          </div>
                          
                          {score.additional_notes && (
                            <div>
                              <h6 className="text-sm font-medium text-gray-900">Additional Notes:</h6>
                              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                {score.additional_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No scores available for this image yet.</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function FolderSection({ folder, expandedImageId, setExpandedImageId }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleImageDetails = (imageId) => {
    setExpandedImageId(expandedImageId === imageId ? null : imageId);
  };

  const hasImages = folder.images && folder.images.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg mb-6 overflow-hidden">
      {/* Folder Header */}
      <div 
        className="bg-gray-50 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg 
                className={`w-5 h-5 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {folder.folder_name}
            </h3>
            {folder.folder_description && (
              <p className="text-sm text-gray-600 mt-1">{folder.folder_description}</p>
            )}
          </div>
          <div className="flex space-x-6 text-sm">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{folder.total_images || 0}</div>
              <div className="text-gray-500">Images</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{folder.total_scores || 0}</div>
              <div className="text-gray-500">Scores</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-purple-600">
                {folder.avg_score ? folder.avg_score.toFixed(2) : 'N/A'}
              </div>
              <div className="text-gray-500">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-indigo-600">{folder.scored_users || 0}</div>
              <div className="text-gray-500">Scorers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Folder Content */}
      {isExpanded && (
        <div>
          {hasImages ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scored By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {folder.images.map((image) => (
                    <React.Fragment key={image.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <img 
                                className="h-10 w-10 rounded object-cover" 
                                src={image.s3_url} 
                                alt={image.filename}
                                onError={(e) => {
                                  e.target.src = '/placeholder-image.png';
                                }}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {image.original_name || image.filename}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(image.upload_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {image.original_name || image.filename}
                            </div>
                            <div className="text-xs text-gray-500">
                              Uploaded: {new Date(image.upload_date).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {image.assigned_to || 0} users
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {image.scored_by || 0} completed
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {image.avg_score ? image.avg_score.toFixed(2) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => toggleImageDetails(image.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            {expandedImageId === image.id ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      
                      <ImageScoreDetails 
                        imageId={image.id}
                        isOpen={expandedImageId === image.id}
                        onClose={() => setExpandedImageId(null)}
                      />
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>No images in this folder yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [expandedImageId, setExpandedImageId] = useState(null);

  const { data: folderData, isLoading, refetch } = useQuery(
    ['folderAnalytics'], 
    () => api.getFolderAnalytics(),
    {
      refetchOnWindowFocus: true,
      staleTime: 30000, // 30 seconds
      cacheTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const folders = folderData?.data?.folders || [];

  const handleRefresh = () => {
    // Invalidate both folder analytics and image scores caches
    queryClient.invalidateQueries(['folderAnalytics']);
    queryClient.invalidateQueries(['imageScores']);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Training Data Analytics</h2>
              <p className="text-sm text-gray-600 mt-1">
                Analytics organized by folder. Click on folder headers to expand/collapse, and image rows to view individual scores.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>

        {/* Overall Stats */}
        {folders.length > 0 && (
          <div className="px-6 py-4 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {folders.length}
                </div>
                <div className="text-sm text-gray-600">Total Folders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {folders.reduce((sum, folder) => sum + (folder.total_images || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Images</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {folders.reduce((sum, folder) => sum + (folder.total_scores || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Scores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {(() => {
                    const totalScores = folders.reduce((sum, folder) => sum + (folder.total_scores || 0), 0);
                    const weightedSum = folders.reduce((sum, folder) => {
                      if (folder.avg_score && folder.total_scores) {
                        return sum + (folder.avg_score * folder.total_scores);
                      }
                      return sum;
                    }, 0);
                    return totalScores > 0 ? (weightedSum / totalScores).toFixed(2) : 'N/A';
                  })()}
                </div>
                <div className="text-sm text-gray-600">Overall Avg</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Folder Sections */}
      {folders.length > 0 ? (
        <div className="space-y-6">
          {folders.map((folder) => (
            <FolderSection
              key={folder.folder_id}
              folder={folder}
              expandedImageId={expandedImageId}
              setExpandedImageId={setExpandedImageId}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              No folders or images found. Upload some images to folders to start collecting training data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
