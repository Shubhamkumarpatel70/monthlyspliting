import React, { createContext, useContext, useState, useEffect } from "react";
import { auth as authApi } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMpinSetup, setShowMpinSetup] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((data) => {
        setUser(data);
        // Don't show prompt on page load, only after fresh login
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem("token", data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      role: data.role,
      hasMpin: data.hasMpin,
    });
    // Show MPIN setup prompt if user doesn't have MPIN
    if (!data.hasMpin) {
      setShowMpinSetup(true);
    }
    return data;
  };

  const loginWithMobile = async (mobile, password) => {
    const data = await authApi.loginMobile(mobile, password);
    localStorage.setItem("token", data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      role: data.role,
      hasMpin: data.hasMpin,
    });
    // Show MPIN setup prompt if user doesn't have MPIN
    if (!data.hasMpin) {
      setShowMpinSetup(true);
    }
    return data;
  };

  const signup = async (
    name,
    email,
    password,
    mobile,
    otpCode,
    otpType,
    mpin,
  ) => {
    const data = await authApi.signup(
      name,
      email,
      password,
      mobile,
      otpCode,
      otpType,
      mpin,
    );
    localStorage.setItem("token", data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      emailVerified: data.emailVerified,
      role: data.role,
      hasMpin: !!mpin,
    });
    return data;
  };

  const loginWithOTP = async (token, userData) => {
    localStorage.setItem("token", token);
    setUser({
      _id: userData._id,
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      role: userData.role,
      hasMpin: userData.hasMpin,
    });
    if (!userData.hasMpin) {
      setShowMpinSetup(true);
    }
    return { token, user: userData };
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setShowMpinSetup(false);
  };

  const loginWithMpin = async (email, mpin) => {
    const data = await authApi.loginMpin(email, mpin);
    localStorage.setItem("token", data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      role: data.role,
      hasMpin: true,
    });
    return data;
  };

  const saveMpin = async (mpin) => {
    await authApi.setMpin(mpin);
    setUser((prev) => (prev ? { ...prev, hasMpin: true } : prev));
    setShowMpinSetup(false);
  };

  const dismissMpinSetup = () => {
    setShowMpinSetup(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithMobile,
        loginWithMpin,
        signup,
        loginWithOTP,
        logout,
        saveMpin,
        showMpinSetup,
        dismissMpinSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
