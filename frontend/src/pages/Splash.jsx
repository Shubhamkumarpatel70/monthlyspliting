import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user) navigate('/dashboard', { replace: true });
      else navigate('/login', { replace: true });
    }, 1800);
    return () => clearTimeout(t);
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center overflow-hidden">
      <div className={`transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-surface border border-primary/30 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-textPrimary tracking-tight">Monthly Split</h1>
          <p className="text-textSecondary mt-2 text-sm">Expense & bill splitting for roommates & family</p>
        </div>
      </div>
      <div className="mt-12 w-32 h-1 rounded-full bg-surface overflow-hidden">
        <div className="h-full w-full bg-primary rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ transformOrigin: 'left' }} />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
