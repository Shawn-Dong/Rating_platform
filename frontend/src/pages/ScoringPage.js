import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useAuth';

const KSS_SCALE = [
  { value: 1, label: 'Very alert', description: 'Feeling active, vital, alert, or wide awake' },
  { value: 2, label: 'Alert', description: 'Functioning at high levels, but not at peak; able to concentrate' },
  { value: 3, label: 'Neither alert nor sleepy', description: 'Awake, but relaxed; responsive but not fully alert' },
  { value: 4, label: 'Rather alert', description: 'Somewhat fresh' },
  { value: 5, label: 'Neither alert nor sleepy', description: 'Foggy; losing interest in remaining awake; slowed down' },
  { value: 6, label: 'Some signs of sleepiness', description: 'Sleepy, woozy, fighting sleep; prefer to lie down' },
  { value: 7, label: 'Sleepy, but no effort to keep awake', description: 'No longer fighting sleep; drifting into sleep onset' },
  { value: 8, label: 'Sleepy, some effort to keep awake', description: 'Asleep, but can be awakened without difficulty' },
  { value: 9, label: 'Very sleepy, great effort to keep awake', description: 'Very difficult to stay awake' }
];

export default function ScoringPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState(null);
  const [selectedScore, setSelectedScore] = useState(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

  // Get next image to score
  const { data: imageData, isLoading: imageLoading, error: imageError } = useQuery(
    'nextImage',
    api.getNextImage,
    {
      refetchOnMount: true,
      onSuccess: () => {
        setStartTime(Date.now());
        reset();
        setSelectedScore(null);
      }
    }
  );

  // Get user progress
  const { data: progressData } = useQuery('progress', api.getProgress);

  // Submit score mutation
  const submitScoreMutation = useMutation(api.submitScore, {
    onSuccess: () => {
      toast.success('Score submitted successfully!');
      queryClient.invalidateQueries('nextImage');
      queryClient.invalidateQueries('progress');
      reset();
      setSelectedScore(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to submit score');
    }
  });

  const explanation = watch('explanation');

  const onSubmit = (data) => {
    if (!selectedScore) {
      toast.error('Please select a KSS score');
      return;
    }

    const timeSpentSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

    const scoreData = {
      image_id: imageData.data.image.id,
      kss_score: selectedScore,
      explanation: data.explanation,
      additional_notes: data.additional_notes || '',
      time_spent_seconds: timeSpentSeconds
    };

    submitScoreMutation.mutate(scoreData);
  };

  if (imageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading next image...</p>
        </div>
      </div>
    );
  }

  if (imageError || !imageData?.data?.image) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 max-w-md">
            <div className="text-green-600 text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              All Done!
            </h2>
            <p className="text-green-700">
              You have completed all your assigned images. Great work!
            </p>
            {progressData && (
              <div className="mt-4 text-sm text-green-600">
                Total completed: {progressData.data.progress.completed} images
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const image = imageData.data.image;
  const progress = progressData?.data?.progress;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        {progress && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Image Scoring</h1>
              <div className="text-sm text-gray-600">
                {progress.completed} of {progress.total_assigned} completed ({progress.completion_percentage}%)
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.completion_percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Display */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Image to Score</h2>
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={image.s3_url || `/images/${image.filename}`}
                alt={`Score this image - ${image.original_name || image.filename}`}
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
            </div>
          </div>

          {/* Scoring Form */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">KSS Rating</h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* KSS Scale Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Sleepiness Level (1-9)
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {KSS_SCALE.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSelectedScore(item.value)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selectedScore === item.value
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="font-semibold text-lg mr-3 mt-1">
                          {item.value}
                        </span>
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanation Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  Explain what you observed that led to your score (minimum 10 characters)
                </p>
                <textarea
                  {...register('explanation', {
                    required: 'Explanation is required',
                    minLength: {
                      value: 10,
                      message: 'Explanation must be at least 10 characters'
                    }
                  })}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the physical indicators you observed (e.g., 'Eyes are droopy with heavy eyelids, head is slightly tilted, showing clear signs of sleepiness...')"
                />
                {errors.explanation && (
                  <p className="text-red-500 text-sm mt-1">{errors.explanation.message}</p>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {explanation?.length || 0} characters
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  {...register('additional_notes')}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional observations or concerns..."
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedScore && (
                    <span className="font-medium">
                      Selected: {selectedScore} - {KSS_SCALE[selectedScore - 1]?.label}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!selectedScore || !explanation || explanation.length < 10 || submitScoreMutation.isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {submitScoreMutation.isLoading ? 'Submitting...' : 'Submit Score'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Scoring Guidelines Reference */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">What to Look For:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Eyes:</strong> Droopy eyelids, blinking frequency, focus</li>
                <li>• <strong>Head position:</strong> Tilting, nodding, upright posture</li>
                <li>• <strong>Facial expression:</strong> Muscle tension, alertness</li>
                <li>• <strong>Body posture:</strong> Slouching, leaning, overall engagement</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Explanation Tips:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Be specific about what you observe</li>
                <li>• Focus on objective physical indicators</li>
                <li>• Explain your reasoning for the score</li>
                <li>• 1-2 sentences is usually sufficient</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 