import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              {/* University of Michigan Logo */}
              <img 
                src="/umich_icon.jpg" 
                alt="University of Michigan" 
                className="h-10 w-10 object-contain"
              />
              <Link 
                to={isAdmin ? "/admin" : "/dashboard"} 
                className="text-xl font-bold text-gray-900"
              >
                KSS Rating Platform
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAdmin ? (
                <>
                  <Link 
                    to="/admin" 
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Admin Dashboard
                  </Link>
                  <Link 
                    to="/profile" 
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Profile
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/dashboard" 
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    to="/score" 
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Score Images
                  </Link>
                  <Link 
                    to="/profile" 
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Profile
                  </Link>
                </>
              )}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  Hello, {user?.guest_name || user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
} 