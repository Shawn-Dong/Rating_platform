import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallbackPage() {
  const { checkAuthStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('token', token);
      checkAuthStatus().then((user) => {
        // Redirect based on user role after OAuth callback
        const defaultRoute = user?.role === 'admin' ? '/admin' : '/dashboard';
        navigate(defaultRoute);
      });
    } else {
      navigate('/login');
    }
  }, [location, navigate, checkAuthStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* University of Michigan Logo - Top Left */}
      <div className="absolute top-4 left-4 flex items-center space-x-3">
        <img 
          src="/umich_icon.jpg" 
          alt="University of Michigan" 
          className="h-10 w-10 object-contain"
        />
        <span className="text-lg font-bold text-gray-900">University of Michigan</span>
      </div>
      
      <div className="flex items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Authenticating...</p>
      </div>
    </div>
  );
}
