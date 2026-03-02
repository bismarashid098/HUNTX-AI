import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FTEChat from './pages/FTEChat';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/chat" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/chat"            element={<ProtectedRoute><FTEChat /></ProtectedRoute>} />
      <Route path="*"                element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0c2118',
                color: '#ecfdf5',
                border: '1px solid rgba(34,197,94,0.20)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: '0.84rem',
                borderRadius: '12px',
              },
              success: { iconTheme: { primary: '#4ade80', secondary: '#0c2118' } },
              error:   { iconTheme: { primary: '#f87171', secondary: '#0c2118' } },
            }}
          />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
