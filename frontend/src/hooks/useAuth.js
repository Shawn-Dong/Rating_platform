import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor for auth token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token is still valid
      checkAuthStatus();
    } else {
      setLoading(false);
    }

    // Response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
          toast.error('Session expired. Please log in again.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/login', {
        username,
        password,
      });

      const { user, token } = response.data;
      
      // Store token
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      
      toast.success(`Welcome back, ${user.username}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);

      const { user, token } = response.data;
      
      // Store token
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      
      toast.success(`Account created successfully! Welcome, ${user.username}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully');
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      toast.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to change password';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    changePassword,
    checkAuthStatus, // Expose checkAuthStatus
    isAdmin: user?.role === 'admin',
    isScorer: user?.role === 'scorer',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for making authenticated API calls
export function useApi() {
  const api = {
    // Image-related endpoints
    getNextImage: () => axios.get('/images/next'),
    getProgress: () => axios.get('/images/progress'),
    getImages: (params) => axios.get('/images/all', { params }),
    getImage: (imageId) => axios.get(`/images/${imageId}`),
    
    // Scoring endpoints
    submitScore: (scoreData) => axios.post('/scores', scoreData),
    getMyScores: () => axios.get('/scores/my-scores'),
    
    // Admin endpoints
    getDashboardStats: () => axios.get('/admin/dashboard'),
    getUsers: () => axios.get('/admin/users'),
    createUser: (userData) => axios.post('/admin/users', userData),
    updateUserStatus: (userId, isActive) => 
      axios.patch(`/admin/users/${userId}/status`, { is_active: isActive }),
    getAnalytics: () => axios.get('/admin/analytics/scores'),
    getReliability: () => axios.get('/admin/analytics/reliability'),
    exportScores: () => axios.get('/admin/export/scores'),
    bulkAssign: (assignmentData) => axios.post('/admin/bulk-assign', assignmentData),
    uploadImage: (formData) => axios.post('/admin/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    bulkUploadImages: (formData) => axios.post('/admin/images/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteImage: (imageId) => axios.delete(`/admin/images/${imageId}`),
    bulkDeleteImages: (imageIds) => axios.delete('/admin/images/bulk-delete', {
      data: { imageIds }
    }),
    // Export endpoints
    exportExcel: () => axios.get('/admin/export/excel', { responseType: 'blob' }),
    exportLLMJson: (apiKey, sampleFormat, includeExplanations = true) => 
      axios.post('/admin/export/llm-json', { 
        apiKey, 
        sampleFormat, 
        includeExplanations 
      }, { responseType: 'blob' }),
  };

  return api;
} 