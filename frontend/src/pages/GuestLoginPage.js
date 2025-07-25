import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from 'react-query';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function GuestLoginPage() {
  const { accessCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { guestLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, setValue } = useForm();

  useEffect(() => {
    if (accessCode) {
      setValue('accessCode', accessCode);
    }
  }, [accessCode, setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    
    const result = await guestLogin(data.accessCode, data.guestName, data.guestEmail);
    
    setIsLoading(false);
    
    if (result.success) {
      // Clear all query cache to ensure fresh data for the new user
      queryClient.clear();
      
      // Show welcome message with access code info
      if (result.access_code_info) {
        toast.success(`Welcome to ${result.access_code_info.name}!`);
      }
      
      // Redirect to scoring interface
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* University of Michigan Logo - Top Left */}
      <div className="absolute top-4 left-4 flex items-center space-x-3">
        <img 
          src="/umich_icon.jpg" 
          alt="University of Michigan" 
          className="h-10 w-10 object-contain"
        />
        <span className="text-lg font-bold text-gray-900">University of Michigan</span>
      </div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-blue-600">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            KSS Rating Platform
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Quick Access for Students
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            Enter your information to start scoring images
          </p>
        </div>
        
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700">
                Access Code
              </label>
              <input
                {...register('accessCode', { required: 'Access code is required' })}
                type="text"
                placeholder="Enter your access code"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm uppercase"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.accessCode && (
                <p className="text-red-500 text-sm mt-1">{errors.accessCode.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('guestName', { required: 'Name is required' })}
                type="text"
                placeholder="Enter your full name"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.guestName && (
                <p className="text-red-500 text-sm mt-1">{errors.guestName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="guestEmail" className="block text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                {...register('guestEmail', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                })}
                type="email"
                placeholder="your.email@example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.guestEmail && (
                <p className="text-red-500 text-sm mt-1">{errors.guestEmail.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                    <svg fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  Starting...
                </div>
              ) : (
                'Start Scoring'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Quick Access Instructions
                </span>
              </h3>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Enter the access code provided by your instructor</li>
                <li>• Provide your name for identification</li>
                <li>• Email is optional but recommended for updates</li>
                <li>• You'll be automatically assigned images to score</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Regular account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 