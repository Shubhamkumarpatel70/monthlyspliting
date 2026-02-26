import React, { useState, useEffect } from "react";
import { admin as adminApi } from "../../api";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Filters
  const [status, setStatus] = useState("");
  const [groupId, setGroupId] = useState("");
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState("");

  // Filter options
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [status, groupId, userId, month, pagination.page]);

  const loadFilterOptions = async () => {
    try {
      const [groupsData, usersData] = await Promise.all([
        adminApi.getGroupsList(),
        adminApi.getUsersList(),
      ]);
      setGroups(groupsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 30 };
      if (status) params.status = status;
      if (groupId) params.groupId = groupId;
      if (userId) params.userId = userId;
      if (month) params.month = month;

      const data = await adminApi.getTransactions(params);
      setTransactions(data.transactions || []);
      setStats(data.stats);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch (err) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStatus("");
    setGroupId("");
    setUserId("");
    setMonth("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      completed: "bg-green-500/20 text-green-400 border-green-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return styles[status] || "bg-gray-500/20 text-gray-400";
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary">
          Transactions
        </h1>
        <p className="text-textSecondary text-sm mt-1">
          View and filter all payment transactions
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-surface rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-textSecondary text-xs mb-1">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-400">
              {stats.pending?.count || 0}
            </p>
            <p className="text-textSecondary text-xs">
              ₹{(stats.pending?.amount || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-textSecondary text-xs mb-1">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-400">
              {stats.completed?.count || 0}
            </p>
            <p className="text-textSecondary text-xs">
              ₹{(stats.completed?.amount || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-textSecondary text-xs mb-1">Failed</p>
            <p className="text-xl sm:text-2xl font-bold text-red-400">
              {stats.failed?.count || 0}
            </p>
            <p className="text-textSecondary text-xs">
              ₹{(stats.failed?.amount || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-textSecondary text-xs mb-1">Cancelled</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-400">
              {stats.cancelled?.count || 0}
            </p>
            <p className="text-textSecondary text-xs">
              ₹{(stats.cancelled?.amount || 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface rounded-xl border border-white/5 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="text-textPrimary font-medium text-sm">Filters</h3>
          {(status || groupId || userId || month) && (
            <button
              onClick={clearFilters}
              className="text-primary text-xs hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>

          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Select month"
            className="px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger mb-6">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-surface rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-textSecondary">No transactions found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-darkBg/50 border-b border-white/5">
                  <tr>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      From → To
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Group
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Method
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-textSecondary text-xs font-medium">
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((t) => (
                    <tr key={t._id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="text-danger">
                            {t.from?.name || "Unknown"}
                          </span>
                          <span className="text-textSecondary mx-2">→</span>
                          <span className="text-success">
                            {t.to?.name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-primary font-semibold">
                          ₹{Number(t.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-textSecondary text-sm">
                        {t.group?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-textSecondary text-sm capitalize">
                        {t.paymentMethod || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs border ${getStatusBadge(t.status)}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-textSecondary text-xs">
                        {formatDate(t.paidAt || t.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-textSecondary text-xs font-mono">
                        {t.transactionId || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-white/5">
              {transactions.map((t) => (
                <div key={t._id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs border ${getStatusBadge(t.status)}`}
                    >
                      {t.status}
                    </span>
                    <span className="text-primary font-bold">
                      ₹{Number(t.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-danger">
                      {t.from?.name || "Unknown"}
                    </span>
                    <span className="text-textSecondary mx-2">→</span>
                    <span className="text-success">
                      {t.to?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="text-xs text-textSecondary space-y-1">
                    <p>Group: {t.group?.name || "-"}</p>
                    <p>
                      Method:{" "}
                      <span className="capitalize">
                        {t.paymentMethod || "-"}
                      </span>
                    </p>
                    <p>Date: {formatDate(t.paidAt || t.createdAt)}</p>
                    {t.transactionId && (
                      <p>
                        Ref:{" "}
                        <span className="font-mono">{t.transactionId}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-textSecondary text-sm">
            Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
            total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
