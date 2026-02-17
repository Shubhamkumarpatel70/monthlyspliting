import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../api';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupId, setGroupId] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadExpenses();
  }, [page, groupId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (groupId) params.groupId = groupId;
      const data = await adminApi.getExpenses(params);
      setExpenses(data.expenses);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Expense Management</h1>
        <p className="text-textSecondary text-sm mt-1">View all expenses in the system</p>
      </div>

      {/* Filter */}
      <div className="bg-surface rounded-2xl border border-white/5 p-4 mb-6">
        <input
          type="text"
          placeholder="Filter by Group ID..."
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
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
          <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-darkBg border-b border-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Paid By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Group</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-white/5">
                      <td className="px-6 py-4">
                        <p className="text-textPrimary font-medium">{expense.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-textPrimary font-semibold">₹{expense.amount?.toFixed(2) || '0.00'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-textPrimary text-sm">{expense.payer?.name || 'Unknown'}</p>
                        <p className="text-textSecondary text-xs">{expense.payer?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-textPrimary text-sm">{expense.group?.name || '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-textSecondary text-sm">
                        {new Date(expense.createdAt).toLocaleDateString()}
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
