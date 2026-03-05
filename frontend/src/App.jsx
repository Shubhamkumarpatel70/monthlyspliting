import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import GroupDetail from "./pages/GroupDetail";
import JoinGroup from "./pages/JoinGroup";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import OTPs from "./pages/admin/OTPs";
import Groups from "./pages/admin/Groups";
import Expenses from "./pages/admin/Expenses";
import Transactions from "./pages/admin/Transactions";

// Global MPIN Setup Modal
function MpinSetupModal() {
  const { showMpinSetup, saveMpin, dismissMpinSetup, user } = useAuth();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (showMpinSetup) {
      setDigits(["", "", "", ""]);
      setError("");
      setTimeout(() => {
        const el = document.getElementById("global-mpin-0");
        if (el) el.focus();
      }, 100);
    }
  }, [showMpinSetup]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (value && index < 3) {
      const next = document.getElementById(`global-mpin-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const prev = document.getElementById(`global-mpin-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleSave = async () => {
    const mpinStr = digits.join("");
    if (mpinStr.length !== 4) {
      setError("Please enter all 4 digits");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveMpin(mpinStr);
    } catch (err) {
      setError(err.message || "Failed to save MPIN");
    } finally {
      setSaving(false);
    }
  };

  if (!showMpinSetup || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-xl bg-primary/20 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-textPrimary">Set up MPIN</h2>
          <p className="text-textSecondary text-sm mt-1">
            Create a 4-digit MPIN for quick login
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-center mb-6">
          {digits.map((digit, i) => (
            <input
              key={i}
              id={`global-mpin-${i}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-14 text-center text-2xl font-bold rounded-xl bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={dismissMpinSetup}
            className="flex-1 py-3 rounded-lg bg-white/10 text-textPrimary font-medium hover:bg-white/20 transition"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
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
    <>
      <MpinSetupModal />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <Signup />
            </PublicOnly>
          }
        />
        <Route path="/join/:groupId" element={<JoinGroup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <Layout>
                <GroupDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminLayout>
                <Users />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/otps"
          element={
            <AdminRoute>
              <AdminLayout>
                <OTPs />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/groups"
          element={
            <AdminRoute>
              <AdminLayout>
                <Groups />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/expenses"
          element={
            <AdminRoute>
              <AdminLayout>
                <Expenses />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <AdminRoute>
              <AdminLayout>
                <Transactions />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
