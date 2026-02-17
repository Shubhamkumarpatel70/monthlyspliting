import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadUsers();
  }, [page, search, status]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const data = await adminApi.getUsers(params);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditData({
      name: user.name,
      email: user.email,
      mobile: user.mobile || '',
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      role: user.role,
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    try {
      await adminApi.updateUser(selectedUser._id, editData);
      setEditOpen(false);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await adminApi.deleteUser(userId);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">User Management</h1>
        <p className="text-textSecondary text-sm mt-1">Manage all users in the system</p>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-white/5 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name, email, or mobile..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-textPrimary font-medium">{user.name}</p>
                            <p className="text-textSecondary text-xs">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-textPrimary text-sm">{user.email}</p>
                        {user.emailVerified && (
                          <span className="text-xs text-green-400">✓ Verified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-textSecondary text-sm">
                        {user.mobile || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.isActive
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}
                        >
                          {user.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 rounded-lg hover:bg-white/5 text-textSecondary hover:text-primary transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="p-2 rounded-lg hover:bg-danger/10 text-textSecondary hover:text-danger transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
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

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditOpen(false)}>
          <div className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Edit User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">Mobile</label>
                <input
                  type="tel"
                  value={editData.mobile}
                  onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.isActive}
                    onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-textSecondary">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.emailVerified}
                    onChange={(e) => setEditData({ ...editData, emailVerified: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-textSecondary">Email Verified</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">Role</label>
                <select
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
