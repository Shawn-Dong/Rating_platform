import React from 'react';
import { useQuery } from 'react-query';
import { useApi } from '../hooks/useAuth';

export default function ImageList() {
  const api = useApi();

  const { data: imagesData, isLoading: imagesLoading } = useQuery('adminImages', () => api.getImages({ all: true }));
  const images = imagesData?.data?.images || [];

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
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Image Library</h2>
      {images.length === 0 ? (
        <p className="text-gray-500">No images have been uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="border rounded-lg overflow-hidden">
              <img src={image.s3_url} alt={image.original_name} className="w-full h-48 object-cover" />
              <div className="p-4">
                <p className="text-sm font-medium text-gray-900 truncate">{image.original_name}</p>
                <p className="text-xs text-gray-500">{image.filename}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
