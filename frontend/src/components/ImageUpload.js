import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function ImageUpload() {
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'bulk'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadResults, setUploadResults] = useState(null);
  const queryClient = useQueryClient();
  const api = useApi();

  // Single image upload mutation
  const singleUploadMutation = useMutation(api.uploadImage, {
    onSuccess: () => {
      toast.success('Image uploaded successfully!');
      setSelectedFiles([]);
      queryClient.invalidateQueries('adminImages');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to upload image.');
    },
  });

  // Bulk image upload mutation
  const bulkUploadMutation = useMutation(api.bulkUploadImages, {
    onSuccess: (response) => {
      const { results } = response.data;
      setUploadResults(results);
      
      if (results.failed.length === 0) {
        toast.success(`All ${results.successful.length} images uploaded successfully!`);
      } else {
        toast.success(`${results.successful.length} uploaded, ${results.failed.length} failed`);
      }
      
      setSelectedFiles([]);
      queryClient.invalidateQueries('adminImages');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to upload images.');
    },
  });

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
    setUploadResults(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error('Please select file(s) to upload.');
      return;
    }

    const formData = new FormData();
    
    if (uploadMode === 'single') {
      formData.append('image', selectedFiles[0]);
      singleUploadMutation.mutate(formData);
    } else {
      selectedFiles.forEach((file) => {
        formData.append('images', file);
      });
      bulkUploadMutation.mutate(formData);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const isLoading = singleUploadMutation.isLoading || bulkUploadMutation.isLoading;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Upload Images</h2>
        
        {/* Upload Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setUploadMode('single');
              setSelectedFiles([]);
              setUploadResults(null);
            }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              uploadMode === 'single'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Single Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode('bulk');
              setSelectedFiles([]);
              setUploadResults(null);
            }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              uploadMode === 'bulk'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bulk Upload
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700">
            {uploadMode === 'single' ? 'Select Image' : 'Select Images (up to 20)'}
          </label>
          <div className="mt-1">
            <input
              id="image-upload"
              name="image-upload"
              type="file"
              accept="image/*"
              multiple={uploadMode === 'bulk'}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          {uploadMode === 'bulk' && (
            <p className="mt-1 text-xs text-gray-500">
              Tip: Hold Cmd/Ctrl to select multiple files, or drag & drop multiple files
            </p>
          )}
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading || selectedFiles.length === 0}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {uploadMode === 'single' ? 'Uploading...' : `Uploading ${selectedFiles.length} files...`}
              </div>
            ) : (
              uploadMode === 'single' ? 'Upload Image' : `Upload ${selectedFiles.length} Images`
            )}
          </button>
        </div>
      </form>

      {/* Upload Results */}
      {uploadResults && uploadMode === 'bulk' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Upload Results</h4>
          
          {uploadResults.successful.length > 0 && (
            <div className="mb-3">
              <h5 className="text-sm font-medium text-green-700 mb-1">
                ✅ Successfully Uploaded ({uploadResults.successful.length})
              </h5>
              <div className="space-y-1">
                {uploadResults.successful.map((result, index) => (
                  <p key={index} className="text-xs text-green-600">{result.originalname}</p>
                ))}
              </div>
            </div>
          )}

          {uploadResults.failed.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-red-700 mb-1">
                ❌ Failed to Upload ({uploadResults.failed.length})
              </h5>
              <div className="space-y-1">
                {uploadResults.failed.map((result, index) => (
                  <p key={index} className="text-xs text-red-600">
                    {result.originalname}: {result.error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
