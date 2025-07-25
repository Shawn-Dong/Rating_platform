import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScoringPage from './pages/ScoringPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ImageDetailPage from './pages/ImageDetailPage';
import GuestLoginPage from './pages/GuestLoginPage';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Styles
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
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
        
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Determine default route based on user role
  const getDefaultRoute = () => {
    if (!user) return "/login";
    return user.role === 'admin' ? "/admin" : "/dashboard";
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to={getDefaultRoute()} replace /> : <LoginPage />} 
      />
      <Route path="/guest/:accessCode?" element={<GuestLoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute allowGuest>
          <Layout />
        </ProtectedRoute>
      }>
        <Route 
          index 
          element={<Navigate to={getDefaultRoute()} replace />} 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute requireScorer allowGuest>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/score" 
          element={
            <ProtectedRoute requireScorer allowGuest>
              <ScoringPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute allowGuest>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/images/:imageId" 
          element={
            <ProtectedRoute requireScorer allowGuest>
              <ImageDetailPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App; 