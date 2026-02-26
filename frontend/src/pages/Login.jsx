import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth as authApi } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState("email"); // 'email' | 'reset'
  const [forgotEmail, setForgotEmail] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnUrl || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmailCheck = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authApi.forgotPasswordCheck(forgotEmail);
      setFoundUser(result);
      setForgotStep("reset");
    } catch (err) {
      setError(err.message || "Email not found");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPasswordReset(forgotEmail, newPassword);
      setSuccessMessage("Password updated successfully! You can now login.");
      setForgotMode(false);
      setForgotStep("email");
      setForgotEmail("");
      setFoundUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelForgot = () => {
    setForgotMode(false);
    setForgotStep("email");
    setForgotEmail("");
    setFoundUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  // Forgot Password UI
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-4 safe-area-inset">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-xl bg-surface border border-primary/30 flex items-center justify-center mb-4">
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-textPrimary">
              Forgot Password
            </h1>
            <p className="text-textSecondary text-sm mt-1">
              {forgotStep === "email"
                ? "Enter your email to reset password"
                : "Set your new password"}
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-white/5 p-6 shadow-xl">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            {forgotStep === "email" ? (
              <form onSubmit={handleForgotEmailCheck}>
                <label className="block text-sm font-medium text-textSecondary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
                  placeholder="you@example.com"
                  required
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelForgot}
                    className="flex-1 py-3 rounded-lg bg-white/10 text-textPrimary font-medium hover:bg-white/20 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    {loading ? "Checking…" : "Find Account"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                {/* User info display */}
                <div className="mb-4 p-4 rounded-xl bg-darkBg/50 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">
                        {foundUser?.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-textPrimary font-medium">
                        {foundUser?.name}
                      </p>
                      <p className="text-textSecondary text-sm">
                        {foundUser?.email}
                      </p>
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-textSecondary mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />

                <label className="block text-sm font-medium text-textSecondary mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelForgot}
                    className="flex-1 py-3 rounded-lg bg-white/10 text-textPrimary font-medium hover:bg-white/20 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    {loading ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-4 safe-area-inset">
      <div className="w-full max-w-sm">
        {/* Toggle between Login / Signup */}
        <div className="mb-6 flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-darkBg shadow"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              const query = returnUrl
                ? `?returnUrl=${encodeURIComponent(returnUrl)}`
                : "";
              navigate(`/signup${query}`);
            }}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-textPrimary hover:bg-white/5 transition"
          >
            Sign up
          </button>
        </div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-xl bg-surface border border-primary/30 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-textPrimary">Welcome back</h1>
          <p className="text-textSecondary text-sm mt-1">
            Sign in to Monthly Split
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-2xl border border-white/5 p-6 shadow-xl"
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm">
              {successMessage}
            </div>
          )}
          <label className="block text-sm font-medium text-textSecondary mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
            placeholder="you@example.com"
            required
          />
          <label className="block text-sm font-medium text-textSecondary mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-2"
            placeholder="••••••••"
            required
            minLength={6}
          />
          <div className="text-right mb-4">
            <button
              type="button"
              onClick={() => setForgotMode(true)}
              className="text-primary text-sm hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-darkBg disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
