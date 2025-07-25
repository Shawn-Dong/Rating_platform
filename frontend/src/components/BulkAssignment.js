import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function BulkAssignment() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());

  // Fetch users and images
  const { data: usersData, isLoading: usersLoading } = useQuery('adminUsers', api.getUsers);
  const { data: imagesData, isLoading: imagesLoading } = useQuery('adminImages', () => api.getImages({ all: true }));

  // Filter for active scorers
  const scorers = useMemo(() => {
    return usersData?.data?.users?.filter(u => u.role === 'guest') || [];
  }, [usersData]);

  const images = imagesData?.data?.images || [];

  // Mutation for submitting assignments
  const bulkAssignMutation = useMutation(api.bulkAssign, {
    onSuccess: (response) => {
      const { successful, skipped } = response.data;
      toast.success(`Successfully created ${successful} new assignments. Skipped ${skipped} duplicates.`);
      setSelectedUserIds(new Set());
      setSelectedImageIds(new Set());
      queryClient.invalidateQueries('adminUsers'); // Invalidate to update assignment counts
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to assign images.');
    },
  });

  // Handlers for selection
  const handleUserSelection = (userId) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const handleImageSelection = (imageId) => {
    const newSelection = new Set(selectedImageIds);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImageIds(newSelection);
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.size === scorers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(scorers.map(u => u.id)));
    }
  };

  const handleSelectAllImages = () => {
    if (selectedImageIds.size === images.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(images.map(i => i.id)));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUserIds.size === 0 || selectedImageIds.size === 0) {
      toast.error('Please select at least one user and one image.');
      return;
    }
    bulkAssignMutation.mutate({
      assignment_type: 'specific',
      user_ids: Array.from(selectedUserIds),
      image_ids: Array.from(selectedImageIds),
    });
  };

  const isLoading = usersLoading || imagesLoading;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk Assign Images</h2>
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading data...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* User Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Select Scorers</h3>
                <button type="button" onClick={handleSelectAllUsers} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  {selectedUserIds.size === scorers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="border rounded-lg h-64 overflow-y-auto p-2 space-y-1">
                {scorers.length > 0 ? scorers.map(user => (
                  <label key={user.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => handleUserSelection(user.id)}
                    />
                    <span className="text-sm text-gray-800">{user.username} ({user.email})</span>
                  </label>
                )) : <p className="text-gray-500 p-2">No active scorers found.</p>}
              </div>
            </div>

            {/* Image Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Select Images</h3>
                <button type="button" onClick={handleSelectAllImages} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  {selectedImageIds.size === images.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="border rounded-lg h-64 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                {images.length > 0 ? images.map(image => (
                  <label key={image.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer border">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={selectedImageIds.has(image.id)}
                      onChange={() => handleImageSelection(image.id)}
                    />
                    <img src={image.s3_url} alt={image.original_name} className="w-10 h-10 object-cover rounded-md" />
                    <span className="text-xs text-gray-700 truncate">{image.original_name}</span>
                  </label>
                )) : <p className="text-gray-500 p-2 col-span-2">No images found.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 text-right">
            <button
              type="submit"
              disabled={bulkAssignMutation.isLoading}
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {bulkAssignMutation.isLoading ? 'Assigning...' : `Assign ${selectedImageIds.size} Images to ${selectedUserIds.size} Users`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
