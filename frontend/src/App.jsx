import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import JoinGroup from './pages/JoinGroup';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Users from './pages/admin/Users';
import OTPs from './pages/admin/OTPs';
import Groups from './pages/admin/Groups';
import Expenses from './pages/admin/Expenses';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/join/:groupId" element={<JoinGroup />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/group/:groupId"
        element={
          <ProtectedRoute>
            <Layout><GroupDetail /></Layout>
          </ProtectedRoute>
        }
      />
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout><AdminDashboard /></AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminLayout><Users /></AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/otps"
        element={
          <AdminRoute>
            <AdminLayout><OTPs /></AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/groups"
        element={
          <AdminRoute>
            <AdminLayout><Groups /></AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/expenses"
        element={
          <AdminRoute>
            <AdminLayout><Expenses /></AdminLayout>
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
