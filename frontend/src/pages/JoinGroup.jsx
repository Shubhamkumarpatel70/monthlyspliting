import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groups as groupsApi, auth as authApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function JoinGroup() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, loginWithMobile } = useAuth();
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('mobile'); // 'mobile' | 'password' | 'confirm'
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    groupsApi.joinInfo(groupId)
      .then((data) => { if (!cancelled) setGroupInfo(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Group not found'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId]);

  // Logged in: show Join / Cancel
  const handleJoinAsLoggedIn = async () => {
    setError('');
    setJoining(true);
    try {
      await groupsApi.join(groupId);
      navigate(`/group/${groupId}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not join');
    } finally {
      setJoining(false);
    }
  };

  const handleCancelAsLoggedIn = () => {
    navigate('/dashboard', { replace: true });
  };

  // Not logged in: check mobile
  const handleMobileSubmit = async (e) => {
    e.preventDefault();
    const m = mobile.replace(/\D/g, '').trim();
    if (!m) return;
    setError('');
    setLoading(true);
    try {
      const { exists } = await authApi.checkMobile(m);
      if (exists) {
        setStep('password');
      } else {
        navigate(`/signup?mobile=${encodeURIComponent(m)}&returnUrl=${encodeURIComponent(`/join/${groupId}`)}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Not logged in: login with mobile + password then join
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) return;
    setError('');
    setJoining(true);
    try {
      await loginWithMobile(mobile.replace(/\D/g, '').trim(), password);
      await groupsApi.join(groupId);
      navigate(`/group/${groupId}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid password or could not join');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || (loading && !groupInfo)) {
    return (
      <div className="min-h-screen bg-darkBg flex items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!groupInfo && !loading) {
    return (
      <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-4">
        <p className="text-danger mb-4">{error || 'Group not found'}</p>
        <button onClick={() => navigate('/')} className="text-primary font-medium">Go home</button>
      </div>
    );
  }

  const groupName = groupInfo?.name || 'this group';

  // Already logged in: show Join / Cancel
  if (user) {
    return (
      <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-4 safe-area-inset">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-xl bg-surface border border-primary/30 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-textPrimary">Join group</h1>
            <p className="text-textSecondary text-sm mt-1">You&apos;re invited to join &quot;{groupName}&quot;</p>
          </div>
          <div className="bg-surface rounded-2xl border border-white/5 p-6 shadow-xl">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelAsLoggedIn}
                className="flex-1 py-3 rounded-lg border border-white/20 text-textSecondary hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleJoinAsLoggedIn}
                disabled={joining}
                className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in: mobile then password or signup
  return (
    <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-4 safe-area-inset">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-xl bg-surface border border-primary/30 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-textPrimary">Join group</h1>
          <p className="text-textSecondary text-sm mt-1">Enter your mobile to join &quot;{groupName}&quot;</p>
        </div>
        <div className="bg-surface rounded-2xl border border-white/5 p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          {step === 'mobile' && (
            <form onSubmit={handleMobileSubmit}>
              <label className="block text-sm font-medium text-textSecondary mb-1">Mobile number</label>
              <input
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="10-digit mobile number"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                maxLength={15}
                required
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 py-3 rounded-lg border border-white/20 text-textSecondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold disabled:opacity-50">
                  {loading ? 'Checking…' : 'Continue'}
                </button>
              </div>
            </form>
          )}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit}>
              <p className="text-textSecondary text-sm mb-3">Account found. Enter your password to join.</p>
              <label className="block text-sm font-medium text-textSecondary mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                minLength={6}
                required
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('mobile')} className="flex-1 py-3 rounded-lg border border-white/20 text-textSecondary">
                  Back
                </button>
                <button type="submit" disabled={joining} className="flex-1 py-3 rounded-lg bg-primary text-darkBg font-semibold disabled:opacity-50">
                  {joining ? 'Joining…' : 'Join group'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
