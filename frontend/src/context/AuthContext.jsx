import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then((data) => setUser(data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('token', data.token);
    setUser({ _id: data._id, name: data.name, email: data.email, mobile: data.mobile });
    return data;
  };

  const loginWithMobile = async (mobile, password) => {
    const data = await authApi.loginMobile(mobile, password);
    localStorage.setItem('token', data.token);
    setUser({ _id: data._id, name: data.name, email: data.email, mobile: data.mobile });
    return data;
  };

  const signup = async (name, email, password, mobile, otpCode, otpType) => {
    const data = await authApi.signup(name, email, password, mobile, otpCode, otpType);
    localStorage.setItem('token', data.token);
    setUser({ _id: data._id, name: data.name, email: data.email, mobile: data.mobile, emailVerified: data.emailVerified });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithMobile, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
