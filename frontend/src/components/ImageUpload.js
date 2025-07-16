import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function ImageUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (formData) => {
      return axios.post('/admin/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    {
      onSuccess: () => {
        toast.success('Image uploaded successfully!');
        setSelectedFile(null);
        queryClient.invalidateQueries('adminImages'); // Assuming you have a query for images
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to upload image.');
      },
    }
  );

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);

    mutation.mutate(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Image</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700">
            Select Image
          </label>
          <div className="mt-1 flex items-center">
            <input
              id="image-upload"
              name="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">Selected: {selectedFile.name}</p>
          )}
        </div>
        <div>
          <button
            type="submit"
            disabled={mutation.isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {mutation.isLoading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
      </form>
    </div>
  );
}
