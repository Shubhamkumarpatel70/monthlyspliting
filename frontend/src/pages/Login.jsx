import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth as authApi } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "";
  const { login, loginWithMpin, saveMpin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState("password"); // 'password' | 'mpin'
  const [mpin, setMpin] = useState(["", "", "", ""]);

  // MPIN setup popup states
  const [showMpinPopup, setShowMpinPopup] = useState(false);
  const [newMpinDigits, setNewMpinDigits] = useState(["", "", "", ""]);
  const [mpinSaving, setMpinSaving] = useState(false);
  const [mpinError, setMpinError] = useState("");

  // Focus first MPIN input when popup opens
  useEffect(() => {
    if (showMpinPopup) {
      setTimeout(() => {
        const firstInput = document.getElementById("new-mpin-0");
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }, [showMpinPopup]);

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (loginMethod === "mpin") {
        const mpinStr = mpin.join("");
        if (mpinStr.length !== 4) {
          setError("Please enter all 4 digits of your MPIN");
          setLoading(false);
          return;
        }
        result = await loginWithMpin(email, mpinStr);
        // MPIN login means user already has MPIN, navigate directly
        navigate(returnUrl || "/dashboard", { replace: true });
      } else {
        result = await login(email, password);
        // Check if user needs to set MPIN (explicitly check for false, not just falsy)
        if (result.hasMpin === false || result.hasMpin === undefined) {
          setLoading(false); // Ensure loading is false before showing popup
          setShowMpinPopup(true);
          return; // Exit early to prevent finally block from interfering
        } else {
          navigate(returnUrl || "/dashboard", { replace: true });
        }
      }
    } catch (err) {
      const msg = err.message || "Login failed";
      // If account not found, redirect to signup
      if (
        msg.toLowerCase().includes("account not found") ||
        msg.toLowerCase().includes("not found")
      ) {
        const query = returnUrl
          ? `?returnUrl=${encodeURIComponent(returnUrl)}`
          : "";
        navigate(`/signup${query}`, {
          state: { email, message: "Account not found. Please sign up." },
        });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMpinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...newMpinDigits];
    newDigits[index] = value.slice(-1);
    setNewMpinDigits(newDigits);
    if (value && index < 3) {
      const next = document.getElementById(`new-mpin-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleNewMpinKeyDown = (index, e) => {
    if (e.key === "Backspace" && !newMpinDigits[index] && index > 0) {
      const prev = document.getElementById(`new-mpin-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleSaveMpin = async () => {
    const mpinStr = newMpinDigits.join("");
    if (mpinStr.length !== 4) {
      setMpinError("Please enter all 4 digits");
      return;
    }
    setMpinSaving(true);
    setMpinError("");
    try {
      await saveMpin(mpinStr);
      setShowMpinPopup(false);
      navigate(returnUrl || "/dashboard", { replace: true });
    } catch (err) {
      setMpinError(err.message || "Failed to save MPIN");
    } finally {
      setMpinSaving(false);
    }
  };

  const handleSkipMpin = () => {
    setShowMpinPopup(false);
    navigate(returnUrl || "/dashboard", { replace: true });
  };

  const handleMpinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newMpin = [...mpin];
    newMpin[index] = value.slice(-1);
    setMpin(newMpin);
    if (value && index < 3) {
      const next = document.getElementById(`mpin-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleMpinKeyDown = (index, e) => {
    if (e.key === "Backspace" && !mpin[index] && index > 0) {
      const prev = document.getElementById(`mpin-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleMpinPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    const newMpin = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) newMpin[i] = pasted[i];
    setMpin(newMpin);
    const focusIdx = Math.min(pasted.length, 3);
    const el = document.getElementById(`mpin-${focusIdx}`);
    if (el) el.focus();
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

  const EyeIcon = ({ show, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-primary transition p-1"
      tabIndex={-1}
    >
      {show ? (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.5 6.5m3.378 3.378L6.5 6.5m7.621 7.621L17.5 17.5m-3.379-3.379L17.5 17.5M3 3l18 18"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      )}
    </button>
  );

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
                <div className="relative mb-4">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <EyeIcon
                    show={showNewPassword}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  />
                </div>
                <label className="block text-sm font-medium text-textSecondary mb-1">
                  Confirm Password
                </label>
                <div className="relative mb-4">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <EyeIcon
                    show={showConfirmPassword}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </div>
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

          {/* Login method toggle */}
          <div className="flex rounded-lg bg-darkBg border border-white/10 p-0.5 mb-4">
            <button
              type="button"
              onClick={() => setLoginMethod("password")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${loginMethod === "password" ? "bg-primary text-darkBg shadow" : "text-textSecondary hover:text-textPrimary"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("mpin")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${loginMethod === "mpin" ? "bg-primary text-darkBg shadow" : "text-textSecondary hover:text-textPrimary"}`}
            >
              MPIN
            </button>
          </div>

          {loginMethod === "password" ? (
            <>
              <label className="block text-sm font-medium text-textSecondary mb-1">
                Password
              </label>
              <div className="relative mb-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <EyeIcon
                  show={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                />
              </div>
              <div className="text-right mb-4">
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-primary text-sm hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-textSecondary mb-1">
                Enter 4-digit MPIN
              </label>
              <div className="flex gap-3 justify-center mb-4">
                {mpin.map((digit, i) => (
                  <input
                    key={i}
                    id={`mpin-${i}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleMpinChange(i, e.target.value)}
                    onKeyDown={(e) => handleMpinKeyDown(i, e)}
                    onPaste={i === 0 ? handleMpinPaste : undefined}
                    className="w-14 h-14 text-center text-2xl font-bold rounded-xl bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                ))}
              </div>
              <p className="text-textSecondary text-xs text-center mb-4">
                Enter your 4-digit MPIN to login quickly
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-darkBg disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      {/* MPIN Setup Popup */}
      {showMpinPopup && (
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
              <h2 className="text-xl font-bold text-textPrimary">
                Set up MPIN
              </h2>
              <p className="text-textSecondary text-sm mt-1">
                Create a 4-digit MPIN for quick login
              </p>
            </div>

            {mpinError && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm text-center">
                {mpinError}
              </div>
            )}

            <div className="flex gap-3 justify-center mb-6">
              {newMpinDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`new-mpin-${i}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleNewMpinChange(i, e.target.value)}
                  onKeyDown={(e) => handleNewMpinKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold rounded-xl bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSkipMpin}
                className="flex-1 py-3 rounded-lg bg-white/10 text-textPrimary font-medium hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMpin}
                disabled={mpinSaving}
                className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {mpinSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
