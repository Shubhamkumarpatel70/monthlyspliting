import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../api';

export default function OTPs() {
  const [otps, setOtps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    verified: '',
    purpose: '',
    email: '',
    mobile: '',
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadOTPs();
  }, [page, filters]);

  const loadOTPs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const data = await adminApi.getOTPs(params);
      setOtps(data.otps);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load OTPs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this OTP?')) return;
    try {
      await adminApi.deleteOTP(id);
      loadOTPs();
    } catch (err) {
      setError(err.message || 'Failed to delete OTP');
    }
  };

  const handleBulkDelete = async (type) => {
    const message = type === 'expired' 
      ? 'Are you sure you want to delete all expired OTPs?'
      : 'Are you sure you want to delete all verified OTPs?';
    if (!window.confirm(message)) return;
    try {
      await adminApi.deleteOTPs({ [type]: 'true' });
      loadOTPs();
    } catch (err) {
      setError(err.message || 'Failed to delete OTPs');
    }
  };

  const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">OTP Management</h1>
          <p className="text-textSecondary text-sm mt-1">View and manage all OTP codes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleBulkDelete('expired')}
            className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textSecondary hover:text-textPrimary hover:bg-white/5 transition"
          >
            Delete Expired
          </button>
          <button
            onClick={() => handleBulkDelete('verified')}
            className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textSecondary hover:text-textPrimary hover:bg-white/5 transition"
          >
            Delete Verified
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-white/5 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <select
            value={filters.verified}
            onChange={(e) => {
              setFilters({ ...filters, verified: e.target.value });
              setPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Status</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            value={filters.purpose}
            onChange={(e) => {
              setFilters({ ...filters, purpose: e.target.value });
              setPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Purposes</option>
            <option value="signup">Signup</option>
            <option value="login">Login</option>
            <option value="reset">Reset</option>
          </select>
          <input
            type="text"
            placeholder="Filter by email..."
            value={filters.email}
            onChange={(e) => {
              setFilters({ ...filters, email: e.target.value });
              setPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="text"
            placeholder="Filter by mobile..."
            value={filters.mobile}
            onChange={(e) => {
              setFilters({ ...filters, mobile: e.target.value });
              setPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-darkBg border-b border-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Email/Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Purpose</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Attempts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {otps.map((otp) => (
                    <tr key={otp._id} className="hover:bg-white/5">
                      <td className="px-6 py-4">
                        <code className="text-primary font-mono text-sm">{otp.code}</code>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-textPrimary text-sm">{otp.email || otp.mobile || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {otp.purpose}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-1 rounded text-xs w-fit ${
                              otp.verified
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}
                          >
                            {otp.verified ? 'Verified' : 'Pending'}
                          </span>
                          {isExpired(otp.expiresAt) && (
                            <span className="px-2 py-1 rounded text-xs w-fit bg-red-500/20 text-red-400 border border-red-500/30">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-textSecondary text-sm">
                        {new Date(otp.expiresAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-textSecondary text-sm">
                        {otp.attempts || 0}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(otp._id)}
                          className="p-2 rounded-lg hover:bg-danger/10 text-textSecondary hover:text-danger transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-textSecondary text-sm">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
