import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useApi } from '../hooks/useAuth';

export default function ImageDetailPage() {
  const { imageId } = useParams();
  const api = useApi();

  const { data, isLoading, error } = useQuery(['imageDetail', imageId], () => api.getImage(imageId));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Loading image details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error.message}</div>
      </div>
    );
  }

  const image = data?.data?.image;
  const statistics = data?.data?.statistics;
  const individualScores = data?.data?.individual_scores || [];

  if (!image) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Image not found.</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Image Details: {image.original_name || image.filename}</h1>
        <p className="mt-2 text-gray-600">
          Review individual scores and statistics for this image.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Display */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Image Preview</h2>
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <img 
              src={image.s3_url || `/images/${image.filename}`}
              alt={image.original_name || image.filename}
              className="w-full h-auto max-h-96 object-contain"
              onError={(e) => {
                e.target.src = '/placeholder-image.png'; // Fallback image
              }}
            />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>Filename: {image.original_name || image.filename}</p>
            {image.metadata && (
              <p>Metadata: {image.metadata}</p>
            )}
            <p>Uploaded: {new Date(image.upload_date).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Scoring Statistics */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Scoring Statistics</h2>
          {statistics && statistics.total_scores > 0 ? (
            <div className="space-y-2">
              <p><strong>Total Scores:</strong> {statistics.total_scores}</p>
              <p><strong>Average KSS:</strong> {statistics.avg_score ? statistics.avg_score.toFixed(2) : 'N/A'}</p>
              <p><strong>Min KSS:</strong> {statistics.min_score || 'N/A'}</p>
              <p><strong>Max KSS:</strong> {statistics.max_score || 'N/A'}</p>
            </div>
          ) : (
            <p className="text-gray-600">No scores available for this image yet.</p>
          )}

          <h3 className="text-lg font-semibold mt-6 mb-4">Individual Scores</h3>
          {individualScores.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {individualScores.map((score) => (
                <div key={score.score_id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-gray-900">Scorer: {score.scorer_username}</p>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      KSS: {score.kss_score}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2"><strong>Explanation:</strong> {score.explanation}</p>
                  {score.additional_notes && (
                    <p className="text-sm text-gray-700 mb-2"><strong>Notes:</strong> {score.additional_notes}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Scored on: {new Date(score.scored_at).toLocaleString()} | Time Spent: {score.time_spent_seconds}s
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No individual scores to display.</p>
          )}
        </div>
      </div>
    </div>
  );
}
