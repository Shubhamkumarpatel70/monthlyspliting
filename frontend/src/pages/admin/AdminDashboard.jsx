import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin as adminApi } from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger">
        {error}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.users?.total || 0,
      subtitle: `${stats?.users?.active || 0} active`,
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      link: '/admin/users',
    },
    {
      title: 'Verified Users',
      value: stats?.users?.verified || 0,
      subtitle: `${stats?.users?.total - stats?.users?.verified || 0} unverified`,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      link: '/admin/users?status=verified',
    },
    {
      title: 'Total Groups',
      value: stats?.groups?.total || 0,
      subtitle: 'Active groups',
      icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      link: '/admin/groups',
    },
    {
      title: 'Total Expenses',
      value: stats?.expenses?.total || 0,
      subtitle: 'All expenses',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      link: '/admin/expenses',
    },
    {
      title: 'Active OTPs',
      value: stats?.otps?.active || 0,
      subtitle: `${stats?.otps?.total || 0} total`,
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      link: '/admin/otps?verified=false',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-textPrimary">Admin Dashboard</h1>
        <p className="text-textSecondary text-sm mt-2">Overview of your Monthly Split platform</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-surface rounded-2xl border border-white/5 p-6 hover:border-primary/30 transition group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center border`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <svg className="w-5 h-5 text-textSecondary group-hover:text-primary transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-textSecondary text-sm font-medium mb-1">{card.title}</h3>
            <p className="text-3xl font-bold text-textPrimary mb-1">{card.value.toLocaleString()}</p>
            <p className="text-textSecondary text-xs">{card.subtitle}</p>
          </Link>
        ))}
      </div>

      {/* Recent Users */}
      {stats?.users?.recent && stats.users.recent.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-textPrimary">Recent Users</h2>
            <Link to="/admin/users" className="text-primary text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {stats.users.recent.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-3 rounded-lg bg-darkBg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-textPrimary font-medium text-sm">{user.name}</p>
                    <p className="text-textSecondary text-xs">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.emailVerified && (
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                      Verified
                    </span>
                  )}
                  <span className="text-textSecondary text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
