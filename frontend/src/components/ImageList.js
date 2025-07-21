import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';

// Confirmation Modal Component
function DeleteConfirmationModal({ isOpen, onClose, onConfirm, imageInfo, isBulk = false, selectedCount = 0 }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 text-center mt-4">
            {isBulk ? `Delete ${selectedCount} Images` : 'Delete Image'}
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500 text-center">
              {isBulk 
                ? `Are you sure you want to delete ${selectedCount} selected images?`
                : 'Are you sure you want to delete this image?'
              }
            </p>
            {!isBulk && imageInfo && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>File:</strong> {imageInfo.original_name || imageInfo.filename}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Note:</strong> This will cancel any pending assignments for this image.
                </p>
              </div>
            )}
            {isBulk && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Note:</strong> This will cancel any pending assignments for all selected images. This action cannot be undone.
                </p>
              </div>
            )}
          </div>
          <div className="items-center px-4 py-3">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {isBulk ? `Delete ${selectedCount} Images` : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImageList() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const { data: imagesData, isLoading: imagesLoading } = useQuery('adminImages', () => api.getImages({ all: true }));
  const images = imagesData?.data?.images || [];

  // Single delete mutation
  const deleteMutation = useMutation(api.deleteImage, {
    onSuccess: (response) => {
      const { deletedImageInfo } = response.data;
      toast.success(`Image "${deletedImageInfo.originalName || deletedImageInfo.filename}" deleted successfully`);
      queryClient.invalidateQueries('adminImages');
      setDeleteModalOpen(false);
      setImageToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete image');
      setDeleteModalOpen(false);
      setImageToDelete(null);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation(api.bulkDeleteImages, {
    onSuccess: (response) => {
      const { results } = response.data;
      if (results.failed.length === 0) {
        toast.success(`All ${results.successful.length} images deleted successfully!`);
      } else {
        toast.success(`${results.successful.length} deleted successfully, ${results.failed.length} failed`);
        // Show details about failed deletions
        results.failed.forEach(failure => {
          toast.error(`Failed to delete image ${failure.imageId}: ${failure.error}`);
        });
      }
      queryClient.invalidateQueries('adminImages');
      setDeleteModalOpen(false);
      setSelectedImages(new Set());
      setSelectMode(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete images');
      setDeleteModalOpen(false);
    },
  });

  const handleDeleteClick = (image, event) => {
    event.preventDefault(); // Prevent navigation to image detail page
    event.stopPropagation();
    setImageToDelete(image);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedImages.size > 0) {
      // Bulk delete
      bulkDeleteMutation.mutate(Array.from(selectedImages));
    } else if (imageToDelete) {
      // Single delete
      deleteMutation.mutate(imageToDelete.id);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setImageToDelete(null);
  };

  const handleImageSelect = (imageId) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map(img => img.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) {
      toast.error('Please select images to delete');
      return;
    }
    setImageToDelete(null);
    setDeleteModalOpen(true);
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedImages(new Set());
  };

  if (imagesLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading images...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Image Library</h2>
        
        <div className="flex items-center space-x-3">
          {images.length > 0 && (
            <>
              <button
                onClick={toggleSelectMode}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectMode
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectMode ? 'Cancel Selection' : 'Select Images'}
              </button>
              
              {selectMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedImages.size === images.length ? 'Deselect All' : 'Select All'}
                  </button>
                  
                  {selectedImages.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteMutation.isLoading}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center"
                    >
                      {bulkDeleteMutation.isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      Delete {selectedImages.size} Images
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {selectedImages.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {selectedImages.size} image{selectedImages.size > 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {images.length === 0 ? (
        <p className="text-gray-500">No images have been uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative border rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 group">
              {/* Selection checkbox (only in select mode) */}
              {selectMode && (
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedImages.has(image.id)}
                    onChange={() => handleImageSelect(image.id)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Delete Button (only when not in select mode) */}
              {!selectMode && (
                <button
                  onClick={(e) => handleDeleteClick(image, e)}
                  disabled={deleteMutation.isLoading}
                  className="absolute top-2 right-2 z-10 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700 disabled:bg-gray-400"
                  title="Delete image"
                >
                  {deleteMutation.isLoading && imageToDelete?.id === image.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}

              {/* Image Link - disable link when in select mode */}
              <div 
                className={selectMode ? "cursor-pointer" : ""}
                onClick={selectMode ? () => handleImageSelect(image.id) : undefined}
              >
                              {!selectMode ? (
                <Link to={`/images/${image.id}`} className="block">
                  <img 
                    src={image.s3_url} 
                    alt={image.original_name} 
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-image.png';
                    }}
                  />
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-900 truncate" title={image.original_name || image.filename}>
                      {image.original_name || image.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(image.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                              ) : (
                <>
                  <img 
                    src={image.s3_url} 
                    alt={image.original_name} 
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-image.png';
                    }}
                  />
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-900 truncate" title={image.original_name || image.filename}>
                      {image.original_name || image.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(image.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        imageInfo={imageToDelete}
        isBulk={selectedImages.size > 0}
        selectedCount={selectedImages.size}
      />
    </div>
  );
}
