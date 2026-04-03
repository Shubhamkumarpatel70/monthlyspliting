import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { admin as adminApi } from "../../api";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext"; // Add this import

const EXPENSE_CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Bills",
  "Shopping",
  "Entertainment",
  "Groceries",
  "Health",
  "Others",
  "Utilities",
  "Misc",
  "Custom",
];

const categoryLabel = (ex) =>
  ex.category === "Custom" && ex.customCategory
    ? ex.customCategory
    : ex.category || "—";

const formatMoney = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "0.00";

const formatExpenseDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [month, setMonth] = useState("");
  const [payerId, setPayerId] = useState("");
  const [category, setCategory] = useState("");

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (next !== prev) setPage(1);
        return next;
      });
    }, 320);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [groupsData, usersData] = await Promise.all([
          adminApi.getGroupsList(),
          adminApi.getUsersList(),
        ]);
        setGroups(Array.isArray(groupsData) ? groupsData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (err) {
        console.error("Admin expense filters:", err);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit };
        if (search.trim()) params.search = search.trim();
        if (groupId) params.groupId = groupId;
        if (month) params.month = month;
        if (payerId) params.payerId = payerId;
        if (category) params.category = category;

        const data = await adminApi.getExpenses(params);
        setExpenses(data.expenses || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || null);
      } catch (err) {
        setError(err.message || "Failed to load expenses");
        setExpenses([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [page, limit, search, groupId, month, payerId, category]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setGroupId("");
    setMonth("");
    setPayerId("");
    setCategory("");
    setPage(1);
  };

  const filtersActive = Boolean(
    searchInput.trim() || groupId || month || payerId || category,
  );

  const { user } = useAuth(); // Get current user

  const handleEdit = (expense) => {
    console.log("Edit expense:", expense);
    console.log(
      "Current user ID:",
      user?._id,
      "Expense payer ID:",
      expense.payer?._id,
      "Match:",
      user?._id === expense.payer?._id,
    );
  };

  const handleDelete = (expense) => {
    console.log("Delete expense:", expense);
    console.log(
      "Current user ID:",
      user?._id,
      "Expense payer ID:",
      expense.payer?._id,
      "Match:",
      user?._id === expense.payer?._id,
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary">
            Expense management
          </h1>
          <p className="text-textSecondary text-sm mt-1 max-w-xl">
            Browse every expense in the system. Filter by group, month, payer,
            category, or description.
          </p>
        </div>
        <Link
          to="/admin"
          className="text-sm text-primary font-medium hover:underline shrink-0"
        >
          ← Dashboard
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-1">
              Matching expenses
            </p>
            <p className="text-2xl font-bold text-textPrimary">
              {(summary.count ?? 0).toLocaleString()}
            </p>
            <p className="text-textSecondary text-xs mt-1">
              With current filters
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-1">
              Sum of amounts (filtered)
            </p>
            <p className="text-2xl font-bold text-primary">
              ₹{formatMoney(summary.totalAmount)}
            </p>
            <p className="text-textSecondary text-xs mt-1">
              Total ₹ across all matching rows
            </p>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-white/5 p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="md:col-span-2 xl:col-span-1">
            <label className="block text-xs text-textSecondary mb-1">
              Search description
            </label>
            <input
              type="search"
              placeholder="e.g. groceries, rent…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm placeholder:text-textSecondary/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs text-textSecondary mb-1">
              Group
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-textSecondary mb-1">
              Month (YYYY-MM)
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs text-textSecondary mb-1">
              Payer
            </label>
            <select
              value={payerId}
              onChange={(e) => {
                setPayerId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-textSecondary mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-textSecondary mb-1">
                Page size
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
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
              <table className="w-full min-w-[900px]">
                <thead className="bg-darkBg border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Payer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Group
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Month
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-textSecondary text-sm"
                      >
                        No expenses found for these filters.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense._id} className="hover:bg-white/5">
                        <td className="px-4 py-3 align-top">
                          <p className="text-textPrimary font-medium text-sm max-w-[220px]">
                            {expense.description}
                          </p>
                          {expense.aiGenerated && (
                            <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-primary/30 text-primary/90">
                              AI
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <span className="text-textPrimary font-semibold">
                            ₹{formatMoney(expense.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-textPrimary">
                          {categoryLabel(expense)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-textPrimary text-sm">
                            {expense.payer?.name || "—"}
                          </p>
                          <p className="text-textSecondary text-xs truncate max-w-[140px]">
                            {expense.payer?.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-textPrimary">
                          {expense.group?.name || "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-textSecondary text-sm whitespace-nowrap">
                          {expense.month || "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-textSecondary text-sm whitespace-nowrap">
                          {formatExpenseDate(expense.date)}
                        </td>
                        <td className="px-4 py-3 align-top flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(expense)}
                            disabled={user?._id !== expense.payer?._id}
                            className="p-2 rounded-lg border border-white/10 bg-surface text-primary disabled:text-gray-400 disabled:bg-gray-900/50 disabled:cursor-not-allowed hover:bg-white/5 disabled:hover:bg-gray-900/20"
                            title={
                              user?._id !== expense.payer?._id
                                ? "You can only edit your own entries"
                                : "Edit"
                            }
                          >
                            <FaEdit size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense)}
                            disabled={user?._id !== expense.payer?._id}
                            className="p-2 rounded-lg border border-white/10 bg-surface text-danger disabled:text-gray-500 disabled:bg-gray-900/50 disabled:cursor-not-allowed hover:bg-white/5 disabled:hover:bg-gray-900/20"
                            title={
                              user?._id !== expense.payer?._id
                                ? "You can only delete your own entries"
                                : "Delete"
                            }
                          >
                            <FaTrash size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pagination && pagination.total > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-textSecondary text-sm">
                Page {pagination.page} of {pagination.pages} ·{" "}
                {pagination.total.toLocaleString()} total
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.pages, p + 1))
                  }
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5"
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
