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
      checkAuthStatus().then(() => {
        navigate('/dashboard');
      });
    } else {
      navigate('/login');
    }
  }, [location, navigate, checkAuthStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="ml-4 text-gray-600">Authenticating...</p>
    </div>
  );
}
