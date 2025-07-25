import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useAuth';

export default function Image() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState('folders'); // 'folders', 'upload', 'list'
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadMode, setUploadMode] = useState('single');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [filterFolder, setFilterFolder] = useState('all');
  const [selectedImages, setSelectedImages] = useState([]);

  const { register: registerFolder, handleSubmit: handleSubmitFolder, reset: resetFolder, formState: { errors: folderErrors } } = useForm();
  
  // Fetch data
  const { data: foldersData, isLoading: foldersLoading } = useQuery('folders', api.getFolders);
  const { data: imagesData, isLoading: imagesLoading } = useQuery('adminImages', () => api.getImages({ all: true }));

  const folders = foldersData?.data?.folders || [];
  const images = imagesData?.data?.images || [];

  // Filter images by folder
  const filteredImages = filterFolder === 'all' 
    ? images 
    : images.filter(img => img.folder_id === parseInt(filterFolder));

  // Create folder mutation
  const createFolderMutation = useMutation(
    ({ name, description }) => api.createFolder(name, description),
    {
      onSuccess: () => {
        toast.success('Folder created successfully');
        queryClient.invalidateQueries('folders');
        setShowCreateFolder(false);
        resetFolder();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to create folder');
      }
    }
  );

  // Upload mutations
  const singleUploadMutation = useMutation(api.uploadImage, {
    onSuccess: () => {
      toast.success('Image uploaded successfully!');
      setSelectedFiles([]);
      // Invalidate both images and folders cache to update counts
      queryClient.invalidateQueries('adminImages');
      queryClient.invalidateQueries('folders');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to upload image.');
    },
  });

  const bulkUploadMutation = useMutation(api.bulkUploadImages, {
    onSuccess: (response) => {
      const { results } = response.data;
      if (results.failed.length === 0) {
        toast.success(`All ${results.successful.length} images uploaded successfully!`);
      } else {
        toast.success(`${results.successful.length} uploaded, ${results.failed.length} failed`);
      }
      setSelectedFiles([]);
      // Invalidate both images and folders cache to update counts
      queryClient.invalidateQueries('adminImages');
      queryClient.invalidateQueries('folders');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to upload images.');
    },
  });

  // Delete mutations
  const deleteImageMutation = useMutation(api.deleteImage, {
    onSuccess: () => {
      toast.success('Image deleted successfully');
      // Invalidate both images and folders cache to update counts
      queryClient.invalidateQueries('adminImages');
      queryClient.invalidateQueries('folders');
      setSelectedImages([]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete image');
    },
  });

  const bulkDeleteMutation = useMutation(api.bulkDeleteImages, {
    onSuccess: () => {
      toast.success('Images deleted successfully');
      // Invalidate both images and folders cache to update counts
      queryClient.invalidateQueries('adminImages');
      queryClient.invalidateQueries('folders');
      setSelectedImages([]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete images');
    },
  });

  // Event handlers
  const onCreateFolder = (data) => {
    createFolderMutation.mutate({
      name: data.name,
      description: data.description || ''
    });
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    const formData = new FormData();
    
    if (uploadMode === 'single') {
      formData.append('image', selectedFiles[0]);
      if (selectedFolder) {
        formData.append('folder_id', selectedFolder);
      }
      singleUploadMutation.mutate(formData);
    } else {
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });
      if (selectedFolder) {
        formData.append('folder_id', selectedFolder);
      }
      bulkUploadMutation.mutate(formData);
    }
  };

  const handleImageSelect = (imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const handleBulkDelete = () => {
    if (selectedImages.length === 0) return;
    
    if (window.confirm(`Delete ${selectedImages.length} selected images?`)) {
      bulkDeleteMutation.mutate(selectedImages);
    }
  };

  if (foldersLoading || imagesLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Image & Folder Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveView('folders')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'folders' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Folders
          </button>
          <button
            onClick={() => setActiveView('upload')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'upload' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Images
          </button>
        </div>
      </div>

      {/* Folders View */}
      {activeView === 'folders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Folder Management</h3>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
            >
              + Create Folder
            </button>
          </div>

          {/* Create Folder Form */}
          {showCreateFolder && (
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <form onSubmit={handleSubmitFolder(onCreateFolder)} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Folder Name *</label>
                  <input
                    {...registerFolder('name', { required: 'Folder name is required' })}
                    type="text"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter folder name"
                  />
                  {folderErrors.name && (
                    <p className="text-red-500 text-sm mt-1">{folderErrors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    {...registerFolder('description')}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createFolderMutation.isLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {createFolderMutation.isLoading ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateFolder(false);
                      resetFolder();
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <div key={folder.id} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{folder.name}</h4>
                    {folder.description && (
                      <p className="text-sm text-gray-600 mt-1">{folder.description}</p>
                    )}
                    <div className="flex items-center space-x-3 mt-2 text-sm text-gray-500">
                      <span>{folder.image_count} images</span>
                      <span>{folder.created_by_username}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(folder.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => {
                      setFilterFolder(folder.id.toString());
                      setActiveView('list');
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Images
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setActiveView('upload');
                    }}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Upload Here
                  </button>
                </div>
              </div>
            ))}
          </div>

          {folders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No folders created yet. Create your first folder to organize images.
            </div>
          )}
        </div>
      )}

      {/* Upload View */}
      {activeView === 'upload' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Upload Images</h3>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            {/* Folder Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Folder (Optional)
              </label>
              <select
                value={selectedFolder || ''}
                onChange={(e) => setSelectedFolder(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                                 <option value="">No specific folder (root)</option>
                 {folders.map((folder) => (
                   <option key={folder.id} value={folder.id}>
                     {folder.name} ({folder.image_count} images)
                   </option>
                 ))}
              </select>
            </div>

            {/* Upload Mode Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Mode</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="single"
                    checked={uploadMode === 'single'}
                    onChange={(e) => setUploadMode(e.target.value)}
                    className="mr-2"
                  />
                  Single Image
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="bulk"
                    checked={uploadMode === 'bulk'}
                    onChange={(e) => setUploadMode(e.target.value)}
                    className="mr-2"
                  />
                  Multiple Images
                </label>
              </div>
            </div>

            {/* File Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select {uploadMode === 'single' ? 'Image' : 'Images'}
              </label>
              <input
                type="file"
                accept="image/*"
                multiple={uploadMode === 'bulk'}
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {selectedFiles.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFiles.length} file(s)
                </p>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || singleUploadMutation.isLoading || bulkUploadMutation.isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {(singleUploadMutation.isLoading || bulkUploadMutation.isLoading) 
                ? 'Uploading...' 
                : `Upload ${selectedFiles.length} Image(s)`
              }
            </button>
          </div>
        </div>
      )}

      {/* Images List View */}
      {activeView === 'list' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Image Library</h3>
            <div className="flex items-center space-x-4">
              {/* Folder Filter */}
                             <select
                 value={filterFolder}
                 onChange={(e) => setFilterFolder(e.target.value)}
                 className="px-3 py-1 border border-gray-300 rounded-md text-sm"
               >
                 <option value="all">All Folders ({images.length})</option>
                 <option value="">No Folder ({images.filter(img => !img.folder_id).length})</option>
                 {folders.map((folder) => (
                   <option key={folder.id} value={folder.id}>
                     {folder.name} ({folder.image_count})
                   </option>
                 ))}
              </select>
              
              {/* Bulk Actions */}
              {selectedImages.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                >
                  Delete ({selectedImages.length})
                </button>
              )}
            </div>
          </div>

          {/* Images Grid */}
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredImages.map((image) => (
                <div key={image.id} className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Selection Checkbox */}
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={selectedImages.includes(image.id)}
                      onChange={() => handleImageSelect(image.id)}
                      className="absolute top-2 left-2 z-10"
                    />
                    <img
                      src={image.s3_url || `/images/${image.filename}`}
                      alt={image.original_name}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                  
                  {/* Image Info */}
                  <div className="p-2">
                    <p className="text-xs text-gray-600 truncate" title={image.original_name}>
                      {image.original_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(image.upload_date).toLocaleDateString()}
                    </p>
                                         {image.folder_id && (
                       <p className="text-xs text-blue-600">
                         {folders.find(f => f.id === image.folder_id)?.name || 'Unknown'}
                       </p>
                     )}
                  </div>
                  
                  {/* Actions */}
                  <div className="px-2 pb-2 flex space-x-1">
                    <Link
                      to={`/admin/images/${image.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this image?')) {
                          deleteImageMutation.mutate(image.id);
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {filterFolder === 'all' 
                ? 'No images uploaded yet.' 
                : 'No images in this folder.'
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
} 