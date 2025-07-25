import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useAuth';

export default function FolderManager() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Fetch folders
  const { data: foldersData, isLoading: foldersLoading } = useQuery(
    'folders', 
    api.getFolders,
    {
      onError: (error) => {
        toast.error('Failed to load folders');
      }
    }
  );

  // Create folder mutation
  const createFolderMutation = useMutation(
    ({ name, description }) => api.createFolder(name, description),
    {
      onSuccess: () => {
        toast.success('Folder created successfully');
        queryClient.invalidateQueries('folders');
        setShowCreateForm(false);
        reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to create folder');
      }
    }
  );

  // Delete folder mutation
  const deleteFolderMutation = useMutation(
    (folderId) => api.deleteFolder(folderId),
    {
      onSuccess: () => {
        toast.success('Folder deleted successfully');
        queryClient.invalidateQueries('folders');
        setSelectedFolder(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete folder');
      }
    }
  );

  const onSubmit = (data) => {
    createFolderMutation.mutate({
      name: data.name,
      description: data.description || ''
    });
  };

  const handleDeleteFolder = (folder) => {
    if (window.confirm(`Are you sure you want to delete "${folder.name}"? This will not delete the images inside.`)) {
      deleteFolderMutation.mutate(folder.id);
    }
  };

  const folders = foldersData?.data?.folders || [];

  if (foldersLoading) {
    return <div className="text-center py-4">Loading folders...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Folder Management</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Create New Folder
        </button>
      </div>

      {/* Create Folder Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Folder</h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                reset();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Folder Name *
              </label>
              <input
                {...register('name', { required: 'Folder name is required' })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter folder name"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={createFolderMutation.isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
              >
                {createFolderMutation.isLoading ? 'Creating...' : 'Create Folder'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  reset();
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folders List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Existing Folders</h3>
        </div>
        
        {folders.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No folders created yet. Create your first folder to organize images.
          </div>
        ) : (
          <div className="divide-y">
            {folders.map((folder) => (
              <div key={folder.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900">{folder.name}</h4>
                    {folder.description && (
                      <p className="text-sm text-gray-600 mt-1">{folder.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>{folder.image_count} images</span>
                      <span>Created by {folder.created_by_username}</span>
                      <span>{new Date(folder.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => setSelectedFolder(folder)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      className="text-red-600 hover:text-red-800 text-sm"
                      disabled={deleteFolderMutation.isLoading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Folder Details Modal */}
      {selectedFolder && (
        <FolderDetailsModal
          folder={selectedFolder}
          onClose={() => setSelectedFolder(null)}
        />
      )}
    </div>
  );
}

// Folder Details Modal Component
function FolderDetailsModal({ folder, onClose }) {
  const api = useApi();
  
  const { data: folderData, isLoading } = useQuery(
    ['folder', folder.id],
    () => api.getFolder(folder.id),
    {
      onError: (error) => {
        toast.error('Failed to load folder details');
      }
    }
  );

  const folderDetails = folderData?.data?.folder;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {folder.name} Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="text-center py-8">Loading folder details...</div>
          ) : folderDetails ? (
            <div className="space-y-6">
              {/* Folder Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Folder Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Name:</span> {folderDetails.name}
                  </div>
                  <div>
                    <span className="font-medium">Images:</span> {folderDetails.image_count}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(folderDetails.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Created by:</span> {folderDetails.created_by_username}
                  </div>
                </div>
                {folderDetails.description && (
                  <div className="mt-2">
                    <span className="font-medium">Description:</span>
                    <p className="text-gray-600 mt-1">{folderDetails.description}</p>
                  </div>
                )}
              </div>

              {/* Images */}
              {folderDetails.images && folderDetails.images.length > 0 ? (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Images in this folder</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folderDetails.images.map((image) => (
                      <div key={image.id} className="border rounded-lg overflow-hidden">
                        <img
                          src={image.s3_url || `/images/${image.filename}`}
                          alt={image.original_name}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate" title={image.original_name}>
                            {image.original_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(image.upload_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No images in this folder yet.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-red-500">
              Failed to load folder details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 