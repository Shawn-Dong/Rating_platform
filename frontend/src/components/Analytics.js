import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useApi } from '../hooks/useAuth';

function ImageScoreDetails({ imageId, isOpen, onClose }) {
  const api = useApi();
  const { data: imageData, isLoading } = useQuery(
    ['imageDetails', imageId], 
    () => api.getImage(imageId),
    { enabled: isOpen }
  );

  if (!isOpen) return null;

  const image = imageData?.data?.image;
  const scores = imageData?.data?.individual_scores || [];
  const stats = imageData?.data?.statistics;

  return (
    <tr>
      <td colSpan="5" className="px-6 py-4 bg-gray-50">
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

          {isLoading ? (
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

export default function Analytics() {
  const api = useApi();
  const [expandedImageId, setExpandedImageId] = useState(null);
  const [page, setPage] = useState(1);

  const { data: imagesData, isLoading } = useQuery(
    ['trainingImages', page], 
    () => api.getImages({ page, limit: 20 })
  );

  const images = imagesData?.data?.images || [];
  const pagination = imagesData?.data?.pagination;

  const toggleImageDetails = (imageId) => {
    setExpandedImageId(expandedImageId === imageId ? null : imageId);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading training data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Training Data Viewer</h2>
        <p className="text-sm text-gray-600 mt-1">
          Click on any image row to view individual scores and explanations from different raters
        </p>
      </div>

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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {images.map((image) => (
              <React.Fragment key={image.id}>
                <tr 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleImageDetails(image.id)}
                >
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

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total images)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {images.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No images found. Upload some images to start collecting training data.</p>
        </div>
      )}
    </div>
  );
}
