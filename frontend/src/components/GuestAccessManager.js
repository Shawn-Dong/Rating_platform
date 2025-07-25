import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

// Component to display assignment plan
function AssignmentPlanDisplay({ assignmentPlan, showTitle = true }) {
  if (!assignmentPlan || !assignmentPlan.assignments) {
    return <div className="text-gray-500 italic">No assignment plan available</div>;
  }

  // Ensure assignments is an array
  const assignments = Array.isArray(assignmentPlan.assignments) ? assignmentPlan.assignments : [];
  
  if (assignments.length === 0) {
    return <div className="text-gray-500 italic">No assignments found in plan</div>;
  }

  return (
    <div>
      {showTitle && (
        <h6 className="font-medium text-gray-900 mb-3">Assignment Plan Preview</h6>
      )}
      <div className="space-y-3">
        {assignments.map((assignment, index) => {
          // Ensure each assignment is an array
          const imageIds = Array.isArray(assignment) ? assignment : [];
          
          return (
            <div key={index} className="p-3 border rounded-lg bg-gray-50">
              <h6 className="font-medium text-gray-900 mb-2">
                Participant {index + 1}
              </h6>
              {imageIds.length > 0 ? (
                <div className="space-y-1">
                  {imageIds.map((imageId, imgIndex) => (
                    <div key={imgIndex} className="p-2 bg-white rounded border text-left text-sm">
                      {assignmentPlan.imageNames?.[imageId] || `Sleep Study Image ${imageId}`}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">No images assigned</div>
              )}
            </div>
          );
        })}
      </div>
      {assignmentPlan.stats && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <div><strong>Total Images:</strong> {assignmentPlan.stats.totalImages}</div>
            <div><strong>Images per Participant:</strong> {assignmentPlan.stats.imagesPerParticipant}</div>
            <div><strong>Total Scores Needed:</strong> {assignmentPlan.stats.totalScoresNeeded}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestAccessManager() {
  const api = useApi();
  const [guestCodes, setGuestCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [scoresPerImage, setScoresPerImage] = useState(3);
  const [expectedParticipants, setExpectedParticipants] = useState(5);
  const [calculationResult, setCalculationResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm();
  
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    loadGuestCodes();
    loadImages();
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await api.getFolders();
      setFolders(response.data.folders || []);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  // Calculate assignment when parameters change
  useEffect(() => {
    calculateAssignment();
  }, [selectedFolder, scoresPerImage, expectedParticipants, images]);

  const calculateAssignment = () => {
    if (!selectedFolder || !scoresPerImage || !expectedParticipants) {
      setCalculationResult(null);
      return;
    }

    // Get images in selected folder
    const folderImages = selectedFolder === 'all' 
      ? images 
      : images.filter(img => img.folder_id === parseInt(selectedFolder));

    const imageCount = folderImages.length;
    
    if (imageCount === 0) {
      setCalculationResult({
        imageCount: 0,
        totalScoresNeeded: 0,
        imagesPerParticipant: 0,
        totalAssignments: 0,
        canComplete: false,
        message: 'No images in selected folder'
      });
      return;
    }

    const totalScoresNeeded = imageCount * scoresPerImage;
    const imagesPerParticipant = Math.ceil(totalScoresNeeded / expectedParticipants);
    const totalAssignments = expectedParticipants * imagesPerParticipant;
    const canComplete = totalAssignments >= totalScoresNeeded;
    
    setCalculationResult({
      imageCount,
      totalScoresNeeded,
      imagesPerParticipant,
      totalAssignments,
      canComplete,
      message: canComplete 
        ? `Assignment complete! ${totalAssignments - totalScoresNeeded} extra scores for redundancy.`
        : `Warning: Need ${totalScoresNeeded - totalAssignments} more scores to complete.`,
      folderImages
    });
  };

  // Generate assignment algorithm
  const generateAssignmentAlgorithm = (folderImages) => {
    if (!calculationResult || !calculationResult.canComplete) return null;

    const assignments = [];
    const imageAssignmentCount = {};
    
    // Initialize assignment counters for each image
    folderImages.forEach(img => {
      imageAssignmentCount[img.id] = 0;
    });

    // For each participant
    for (let participantIndex = 0; participantIndex < expectedParticipants; participantIndex++) {
      const participantAssignments = [];
      
      // Assign images to this participant
      let assignedCount = 0;
      while (assignedCount < calculationResult.imagesPerParticipant) {
        // Find image that needs more assignments (greedy algorithm)
        const availableImages = folderImages.filter(img => 
          imageAssignmentCount[img.id] < scoresPerImage
        );
        
        if (availableImages.length === 0) break;
        
        // Prefer images with fewer assignments
        availableImages.sort((a, b) => imageAssignmentCount[a.id] - imageAssignmentCount[b.id]);
        
        const selectedImage = availableImages[0];
        participantAssignments.push(selectedImage.id);
        imageAssignmentCount[selectedImage.id]++;
        assignedCount++;
      }
      
      assignments.push({
        participantId: `participant_${participantIndex + 1}`,
        imageIds: participantAssignments,
        imageCount: participantAssignments.length
      });
    }

    return {
      assignments,
      imageAssignmentCount,
      totalAssigned: Object.values(imageAssignmentCount).reduce((sum, count) => sum + count, 0)
    };
  };

  const loadGuestCodes = async () => {
    try {
      const response = await api.getGuestCodes();
      const codes = response.data.guest_codes || [];
      
      // Process each code - image_ids is already an array from backend
      const formattedCodes = codes.map(code => {
        let processedImageIds = null;
        
        if (code.image_ids) {
          // Check if image_ids is already an array (from backend) or needs parsing
          if (Array.isArray(code.image_ids)) {
            processedImageIds = code.image_ids;
          } else if (typeof code.image_ids === 'string') {
            try {
              processedImageIds = JSON.parse(code.image_ids);
            } catch (error) {
              console.error('Failed to parse image_ids for code:', code.id, error);
              processedImageIds = [];
            }
          }
        }
        
        return {
          ...code,
          image_ids: processedImageIds,
          guest_url: `${process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000'}/guest/${code.code}`
        };
      });
      
      setGuestCodes(formattedCodes);
    } catch (error) {
      toast.error('Failed to load guest access codes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      const response = await api.getImages();
      setImages(response.data.images || []);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const handleCreateGuestCode = async (data) => {
    try {
      // Validate assignment parameters
      if (!selectedFolder) {
        toast.error('Please select a folder first');
        return;
      }

      if (!calculationResult || !calculationResult.canComplete) {
        toast.error('Assignment calculation shows insufficient coverage. Please adjust parameters.');
        return;
      }

      // Generate the assignment algorithm
      const assignment = generateAssignmentAlgorithm(calculationResult.folderImages);
      
      const guestCodeData = {
        name: data.name,
        description: data.description,
        expires_in_hours: parseInt(data.expires_in_hours),
        max_uses: parseInt(data.max_uses),
        // Use folder-based assignment instead of manual selection
        folder_id: selectedFolder === 'all' ? null : parseInt(selectedFolder),
        image_ids: calculationResult.folderImages.map(img => img.id),
        scores_per_image: scoresPerImage,
        expected_participants: expectedParticipants,
        assignment_algorithm: assignment
      };

      const response = await api.generateGuestCode(guestCodeData);
      
      toast.success(`Guest access code created! Each participant will rate ${calculationResult.imagesPerParticipant} images.`);
      
      // Copy URL to clipboard
      const guestUrl = response.data.guest_url;
      navigator.clipboard.writeText(guestUrl).then(() => {
        toast.success('Guest URL copied to clipboard!');
      });

      // Reset form and state
      reset();
      setSelectedImages([]);
      setSelectedFolder('');
      setScoresPerImage(3);
      setExpectedParticipants(5);
      setCalculationResult(null);
      setPreviewResult(null);
      setShowCreateForm(false);
      
      // Reload guest codes
      loadGuestCodes();
    } catch (error) {
      console.error('Error creating guest code:', error);
      toast.error(error.response?.data?.error || 'Failed to create guest access code');
    }
  };

  const handleDeactivateCode = async (codeId) => {
    if (!window.confirm('Are you sure you want to deactivate this access code?')) {
      return;
    }

    try {
      await api.deactivateGuestCode(codeId);
      toast.success('Access code deactivated successfully');
      loadGuestCodes();
    } catch (error) {
      toast.error('Failed to deactivate access code');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    });
  };

  const handleImageToggle = (imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Guest Access Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showCreateForm ? 'Cancel' : 'Create New Access Code'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow-lg border">
          <h3 className="text-lg font-semibold mb-4">Create Guest Access Code with Smart Assignment</h3>
          
          <form onSubmit={handleSubmit(handleCreateGuestCode)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  type="text"
                  placeholder="e.g., Psychology Class Spring 2024"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  {...register('description')}
                  type="text"
                  placeholder="Brief description of the study"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expires in (hours)
                </label>
                <input
                  {...register('expires_in_hours', { 
                    required: 'Expiration time is required',
                    min: { value: 1, message: 'Must be at least 1 hour' }
                  })}
                  type="number"
                  defaultValue="24"
                  min="1"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.expires_in_hours && (
                  <p className="text-red-500 text-sm mt-1">{errors.expires_in_hours.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Maximum Uses
                </label>
                <input
                  {...register('max_uses', { 
                    required: 'Maximum uses is required',
                    min: { value: 1, message: 'Must be at least 1' }
                  })}
                  type="number"
                  defaultValue="100"
                  min="1"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.max_uses && (
                  <p className="text-red-500 text-sm mt-1">{errors.max_uses.message}</p>
                )}
              </div>
            </div>

            {/* Assignment Parameters Section */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Assignment Parameters</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Select Folder <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a folder...</option>
                    <option value="all">All Images</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} ({folder.image_count} images)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Scores per Image
                  </label>
                  <input
                    type="number"
                    value={scoresPerImage}
                    onChange={(e) => setScoresPerImage(parseInt(e.target.value) || 1)}
                    min="1"
                    max="10"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many people should rate each image</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Expected Participants
                  </label>
                  <input
                    type="number"
                    value={expectedParticipants}
                    onChange={(e) => setExpectedParticipants(parseInt(e.target.value) || 1)}
                    min="1"
                    max="100"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many people will use this code</p>
                </div>
              </div>

              {/* Calculation Results */}
              {calculationResult && (
                                 <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                   <h5 className="font-medium text-blue-900 mb-3">Assignment Calculation</h5>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{calculationResult.imageCount}</div>
                      <div className="text-gray-600">Images</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{calculationResult.totalScoresNeeded}</div>
                      <div className="text-gray-600">Total Scores Needed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{calculationResult.imagesPerParticipant}</div>
                      <div className="text-gray-600">Images per Person</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{calculationResult.totalAssignments}</div>
                      <div className="text-gray-600">Total Assignments</div>
                    </div>
                  </div>

                  <div className={`mt-3 p-2 rounded text-sm ${
                    calculationResult.canComplete 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {calculationResult.message}
                  </div>

                                     {calculationResult.canComplete && (
                     <div className="mt-4">
                       <button
                         type="button"
                         onClick={() => {
                           const algorithm = generateAssignmentAlgorithm(calculationResult.folderImages);
                           setPreviewResult(algorithm);
                           toast.success('Assignment preview generated!');
                         }}
                         className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                       >
                         Preview Assignment Algorithm
                       </button>
                       
                       {previewResult && (
                         <button
                           type="button"
                           onClick={() => setPreviewResult(null)}
                           className="ml-2 bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                         >
                           Hide Preview
                         </button>
                       )}
                     </div>
                   )}

                   {/* Assignment Preview Display */}
                   {previewResult && calculationResult && (
                     <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                       <h6 className="font-medium text-gray-900 mb-4">Assignment Preview</h6>
                       <div className="space-y-4">
                         {previewResult.assignments.map((assignment, index) => {
                           const assignedImages = assignment.imageIds.map(imageId => {
                             const image = calculationResult.folderImages.find(img => img.id === imageId);
                             return image ? image.original_name : `Image ${imageId}`;
                           });
                           
                           return (
                             <div key={assignment.participantId} className="p-4 bg-white border rounded">
                               <div className="font-medium text-gray-800 mb-3">
                                 User {index + 1}: ({assignment.imageCount} images)
                               </div>
                               <div className="grid grid-cols-1 gap-1">
                                 {assignedImages.map((imageName, imgIndex) => (
                                   <div key={imgIndex} className="text-sm text-gray-600 py-1 px-2 bg-gray-50 rounded">
                                     {imageName}
                                   </div>
                                 ))}
                               </div>
                             </div>
                           );
                         })}
                       </div>
                       
                       <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                         <div className="font-medium text-blue-800 mb-1">Summary:</div>
                         <div className="text-blue-700">
                           Total assignments: {previewResult.totalAssigned} | 
                           Average per user: {Math.round(previewResult.totalAssigned / expectedParticipants * 10) / 10}
                         </div>
                       </div>
                     </div>
                   )}
                </div>
              )}
            </div>



            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  reset();
                  setSelectedImages([]);
                  setSelectedFolder('');
                  setScoresPerImage(3);
                  setExpectedParticipants(5);
                  setCalculationResult(null);
                  setPreviewResult(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!calculationResult || !calculationResult.canComplete}
                className={`px-4 py-2 text-white rounded-md ${
                  calculationResult && calculationResult.canComplete
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {calculationResult && calculationResult.canComplete 
                  ? 'Create Smart Assignment Code' 
                  : 'Select Folder & Configure Parameters'
                }
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Active Guest Access Codes</h3>
        </div>

        {guestCodes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No guest access codes created yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {guestCodes.map((code) => (
              <div key={code.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{code.name}</h4>
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                    </div>
                    
                    {code.description && (
                      <p className="text-gray-600 mb-2">{code.description}</p>
                    )}

                    {/* Smart Assignment Info */}
                    {code.folder_id && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">Smart Assignment Configuration</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-blue-800">Target Folder:</span>
                            <div className="text-blue-700">{code.folder_name || `Folder ${code.folder_id}`}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-800">Images:</span>
                            <div className="text-blue-700">{code.image_ids?.length || 0} images</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-800">Scores per Image:</span>
                            <div className="text-blue-700">{code.scores_per_image || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-800">Expected Users:</span>
                            <div className="text-blue-700">{code.expected_participants || 'N/A'}</div>
                          </div>
                        </div>
                        
                        {code.assignment_algorithm && (
                          <div className="mt-3">
                            <span className="font-medium text-blue-800">Images per User:</span>
                            <span className="ml-1 text-blue-700">
                              {(() => {
                                try {
                                  const algorithm = JSON.parse(code.assignment_algorithm);
                                  if (algorithm.assignments && algorithm.assignments.length > 0) {
                                    const firstAssignment = algorithm.assignments[0];
                                    return firstAssignment.imageIds ? firstAssignment.imageIds.length : firstAssignment.imageCount || 0;
                                  }
                                } catch (error) {
                                  console.error('Failed to calculate images per user:', error);
                                }
                                return Math.ceil((code.image_ids?.length || 0) * (code.scores_per_image || 1) / (code.expected_participants || 1));
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Code:</span>
                        <span className="ml-1 font-mono bg-gray-100 px-2 py-1 rounded">
                          {code.code}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Uses:</span>
                        <span className="ml-1">{code.uses_count} / {code.max_uses}</span>
                      </div>
                      <div>
                        <span className="font-medium">Expires:</span>
                        <span className="ml-1">
                          {new Date(code.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Active Users:</span>
                        <span className="ml-1 font-medium text-green-600">{code.guest_users_count}</span>
                      </div>
                    </div>

                    {/* Active Guest Users */}
                    {code.guest_users_count > 0 && (
                      <div className="mb-3 p-3 bg-gray-50 border rounded-lg">
                        <h6 className="font-medium text-gray-900 mb-2">
                          Active Guest Users ({code.guest_users_count}/{code.expected_participants})
                        </h6>
                        <div className="space-y-2">
                          {code.guest_users?.map((user, index) => (
                            <div key={user.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <span className="font-medium text-gray-900">{user.guest_name}</span>
                                <span className="text-gray-500 text-sm ml-2">({user.email})</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {user.assigned_images ? user.assigned_images.length : 0} images assigned
                              </div>
                            </div>
                          )) || (
                            <div className="text-sm text-gray-500 italic">Loading user details...</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-sm font-medium text-gray-700">Guest URL:</span>
                      <code className="flex-1 text-sm bg-gray-50 p-2 rounded border">
                        {code.guest_url}
                      </code>
                      <button
                        onClick={() => copyToClipboard(code.guest_url)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Copy
                      </button>
                    </div>

                    {/* Original Assignment Plan */}
                    {code.assignment_algorithm && (
                      <div className="mt-4">
                        <details className="bg-white border rounded-lg">
                          <summary className="p-3 cursor-pointer font-medium text-blue-900 hover:bg-blue-50">
                            View Original Assignment Plan
                          </summary>
                          <div className="p-3 border-t">
                            <AssignmentPlanDisplay 
                              assignmentPlan={(() => {
                                try {
                                  const algorithm = JSON.parse(code.assignment_algorithm);
                                  // Transform backend format to frontend format
                                  if (algorithm.assignments && Array.isArray(algorithm.assignments)) {
                                    return {
                                      assignments: algorithm.assignments.map(assignment => 
                                        assignment.imageIds || assignment
                                      ),
                                      imageNames: code.image_names_map || {},
                                      stats: {
                                        totalImages: code.image_ids?.length || 0,
                                        imagesPerParticipant: Math.ceil((code.image_ids?.length || 0) * (code.scores_per_image || 1) / (code.expected_participants || 1)),
                                        totalScoresNeeded: (code.image_ids?.length || 0) * (code.scores_per_image || 1)
                                      }
                                    };
                                  }
                                  return algorithm;
                                } catch (error) {
                                  console.error('Failed to parse assignment_algorithm:', error);
                                  return null;
                                }
                              })()}
                              showTitle={false}
                            />
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Current User Assignments */}
                    {code.guest_users_count > 0 && (
                      <div className="mt-4">
                        <details className="bg-white border rounded-lg">
                          <summary className="p-3 cursor-pointer font-medium text-green-900 hover:bg-green-50">
                            View Current User Assignments
                          </summary>
                          <div className="p-3 border-t">
                            {code.guest_users?.map((user, index) => (
                              <div key={user.id} className="mb-4 p-3 border rounded-lg">
                                <h6 className="font-medium text-gray-900 mb-2">
                                  {user.guest_name} ({user.email})
                                </h6>
                                {user.assigned_images && user.assigned_images.length > 0 ? (
                                  <div className="space-y-1">
                                    {user.assigned_images.map((image, imgIndex) => (
                                      <div key={imgIndex} className="p-2 bg-gray-50 rounded border text-left text-sm">
                                        {image.original_name || image.filename || `Sleep Study Image ${image.id}`}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 italic">No images assigned yet</div>
                                )}
                              </div>
                            )) || (
                              <div className="text-sm text-gray-500 italic">Loading user assignments...</div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <button
                      onClick={() => handleDeactivateCode(code.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 