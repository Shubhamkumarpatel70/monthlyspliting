import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin as adminApi } from '../../api';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadGroups();
  }, [page, search]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const data = await adminApi.getGroups(params);
      setGroups(data.groups);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this group? This will also delete all associated expenses.')) return;
    try {
      await adminApi.deleteGroup(id);
      loadGroups();
    } catch (err) {
      setError(err.message || 'Failed to delete group');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Group Management</h1>
        <p className="text-textSecondary text-sm mt-1">Manage all groups in the system</p>
      </div>

      {/* Search */}
      <div className="bg-surface rounded-2xl border border-white/5 p-4 mb-6">
        <input
          type="text"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group._id} className="bg-surface rounded-2xl border border-white/5 p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-textPrimary">{group.name}</h3>
                  <button
                    onClick={() => handleDelete(group._id)}
                    className="p-2 rounded-lg hover:bg-danger/10 text-textSecondary hover:text-danger transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-textSecondary text-sm mb-4">
                  {group.members?.length || 0} members
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-textSecondary text-xs">
                    Created {new Date(group.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/group/${group._id}`}
                    className="text-primary text-sm hover:underline"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
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
