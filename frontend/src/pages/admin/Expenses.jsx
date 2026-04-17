import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { admin as adminApi } from "../../api";
import { useAuth } from "../../context/AuthContext";

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

const formatYearMonthLabel = (ym) => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Latest edit that touched a field (walk from end of history). */
function lastChangeForField(editHistory, field) {
  if (!Array.isArray(editHistory) || editHistory.length === 0) return null;
  for (let i = editHistory.length - 1; i >= 0; i--) {
    const ch = editHistory[i]?.changes?.[field];
    if (ch && typeof ch === "object" && ("from" in ch || "to" in ch)) return ch;
  }
  return null;
}

export default function Expenses() {
  const { user } = useAuth();
  const isAdminUser = user?.role === "admin";

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

  const [historyExpense, setHistoryExpense] = useState(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

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
      if (!isAdminUser) return;
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
  }, [isAdminUser]);

  useEffect(() => {
    const run = async () => {
      if (!isAdminUser) {
        setLoading(false);
        setExpenses([]);
        setSummary(null);
        return;
      }
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
  }, [page, limit, search, groupId, month, payerId, category, isAdminUser]);

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

  const uiDisabled = !isAdminUser;

  if (!isAdminUser) {
    return (
      <div className="p-6 rounded-2xl bg-surface border border-white/10 max-w-lg">
        <h1 className="text-xl font-bold text-textPrimary">
          Expense management
        </h1>
        <p className="text-textSecondary text-sm mt-2">
          This area is only available to administrators. Use the main app as a
          group member to add or edit your own expenses.
        </p>
        <Link
          to="/dashboard"
          className="inline-block mt-4 text-sm text-primary font-medium hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary">
            Expense management
          </h1>
          <p className="text-textSecondary text-sm mt-1 max-w-xl">
            Browse every expense in the system. Filter by group, month, payer,
            category, or description. With a group selected you also see
            lifetime spend for that group; add a month to focus totals on that
            month. Edit history shows before → after when members update an
            expense.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-1">
              Matching expenses
            </p>
            <p className="text-2xl font-bold text-textPrimary">
              {(summary.count ?? 0).toLocaleString()}
            </p>
            <p className="text-textSecondary text-xs mt-1">
              Rows that match every active filter
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-1">
              {summary.hasGroupFilter && summary.selectedMonth
                ? `Total for ${formatYearMonthLabel(summary.selectedMonth)}`
                : summary.hasGroupFilter
                  ? "Total (current filters)"
                  : "Sum of amounts (filtered)"}
            </p>
            <p className="text-2xl font-bold text-primary">
              ₹{formatMoney(summary.totalAmount)}
            </p>
            <p className="text-textSecondary text-xs mt-1 leading-relaxed">
              {summary.hasGroupFilter && summary.selectedMonth
                ? `₹ sum for this group in ${formatYearMonthLabel(summary.selectedMonth)}, plus any payer/category/search filters.`
                : summary.hasGroupFilter
                  ? "₹ sum for rows matching filters. Pick a month to see that month only."
                  : "₹ sum across all rows matching your filters."}
            </p>
          </div>
          {summary.hasGroupFilter && summary.groupAllTimeTotal != null && (
            <div className="bg-surface rounded-xl border border-primary/20 p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-textSecondary text-xs uppercase tracking-wide mb-1">
                Group · all months
              </p>
              <p className="text-2xl font-bold text-textPrimary">
                ₹{formatMoney(summary.groupAllTimeTotal)}
              </p>
              <p className="text-textSecondary text-xs mt-1">
                {(summary.groupAllTimeCount ?? 0).toLocaleString()} expenses in
                this group (ignores month, payer, category & search filters)
              </p>
            </div>
          )}
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
              disabled={uiDisabled}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm placeholder:text-textSecondary/70 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={uiDisabled}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={uiDisabled}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={uiDisabled}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={uiDisabled}
              className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={uiDisabled}
                className="w-full px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={uiDisabled}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
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
              <table className="w-full min-w-[980px]">
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
                    expenses.map((expense) => {
                      const lastDesc = lastChangeForField(
                        expense.editHistory,
                        "description",
                      );
                      const lastAmt = lastChangeForField(
                        expense.editHistory,
                        "amount",
                      );
                      const hasHistory =
                        Array.isArray(expense.editHistory) &&
                        expense.editHistory.length > 0;

                      const isExpanded = expandedExpenseId === expense._id;
                      return (
                        <>
                          <tr key={expense._id} className="hover:bg-white/5">
                            <td className="px-4 py-3 align-top max-w-[240px]">
                              <p className="text-textPrimary font-medium text-sm break-words">
                                {expense.description}
                              </p>
                              {lastDesc && (
                                <p className="text-[11px] sm:text-xs text-amber-400/90 mt-1.5 leading-snug space-y-0.5">
                                  <span className="text-textSecondary block">
                                    Last text change:
                                  </span>
                                  <span className="line-through opacity-75 break-words">
                                    {String(lastDesc.from ?? "—")}
                                  </span>
                                  <span className="text-textSecondary">
                                    {" "}
                                    →{" "}
                                  </span>
                                  <span className="break-words">
                                    {String(lastDesc.to ?? "—")}
                                  </span>
                                </p>
                              )}
                              {expense.aiGenerated && (
                                <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-primary/30 text-primary/90">
                                  AI
                                </span>
                              )}
                              <button
                                type="button"
                                className="block mt-2 text-xs text-primary underline hover:no-underline focus:outline-none"
                                onClick={() =>
                                  setExpandedExpenseId(
                                    isExpanded ? null : expense._id,
                                  )
                                }
                              >
                                {isExpanded ? "Hide details" : "Show details"}
                              </button>
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <span className="text-textPrimary font-semibold">
                                ₹{formatMoney(expense.amount)}
                              </span>
                              {lastAmt && (
                                <p className="text-[11px] sm:text-xs text-amber-400/90 mt-1.5 whitespace-normal">
                                  <span className="text-textSecondary">
                                    Last amount change:
                                  </span>
                                  <br />₹{formatMoney(lastAmt.from)} → ₹
                                  {formatMoney(lastAmt.to)}
                                </p>
                              )}
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
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => setHistoryExpense(expense)}
                                  disabled={uiDisabled}
                                  title={
                                    hasHistory
                                      ? "View full edit history"
                                      : "No edits recorded yet"
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/15 bg-darkBg/60 text-textPrimary text-xs font-medium hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <svg
                                    className="w-3.5 h-3.5 shrink-0 text-primary"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  History
                                </button>
                                {!hasHistory && (
                                  <span className="text-[10px] text-textSecondary">
                                    No edits
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-darkBg/70">
                              <td
                                colSpan={8}
                                className="px-6 pb-4 pt-2 text-sm text-textPrimary"
                              >
                                <div className="mb-2">
                                  <span className="font-semibold">
                                    Split type:
                                  </span>{" "}
                                  {expense.splitType || "equal"}
                                </div>
                                <div className="mb-2">
                                  <span className="font-semibold">
                                    Split among:
                                  </span>
                                  {Array.isArray(expense.participants) &&
                                  expense.participants.length > 0 ? (
                                    <ul className="list-disc ml-6 mt-1">
                                      {expense.participants.map((p) => {
                                        let userId =
                                          typeof p === "object" ? p._id : p;
                                        let userObj = users.find(
                                          (u) => u._id === userId,
                                        );
                                        return (
                                          <li key={userId}>
                                            {userObj
                                              ? `${userObj.name}${userObj.email ? ` (${userObj.email})` : ""}`
                                              : userId}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <span className="ml-2">
                                      All group members
                                    </span>
                                  )}
                                </div>
                                {expense.splitValues &&
                                  Object.keys(expense.splitValues).length >
                                    0 && (
                                    <div className="mb-2">
                                      <span className="font-semibold">
                                        Split values:
                                      </span>
                                      <ul className="list-disc ml-6 mt-1">
                                        {Object.entries(
                                          expense.splitValues,
                                        ).map(([userId, value]) => (
                                          <li key={userId}>
                                            {userId}: {value}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                {/* Add clearance type here if available in data */}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
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
                  disabled={page <= 1 || uiDisabled}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.pages, p + 1))
                  }
                  disabled={page >= pagination.pages || uiDisabled}
                  className="px-4 py-2 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {historyExpense && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-history-title"
          onClick={() => setHistoryExpense(null)}
        >
          <div
            className="bg-surface border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="expense-history-title"
                  className="text-lg font-semibold text-textPrimary"
                >
                  Edit history
                </h2>
                <p className="text-xs text-textSecondary mt-1 truncate">
                  {historyExpense.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryExpense(null)}
                className="shrink-0 p-2 rounded-lg text-textSecondary hover:bg-white/10"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {!Array.isArray(historyExpense.editHistory) ||
              historyExpense.editHistory.length === 0 ? (
                <p className="text-textSecondary text-sm">
                  No edits have been recorded for this expense yet. Changes made
                  after this update ships will appear here.
                </p>
              ) : (
                [...historyExpense.editHistory]
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <div
                      key={entry._id || idx}
                      className="rounded-xl border border-white/10 bg-darkBg/50 p-3 text-sm"
                    >
                      <p className="text-textSecondary text-xs mb-2">
                        {formatDateTime(entry.at)} ·{" "}
                        <span className="text-textPrimary font-medium">
                          {entry.editedBy?.name || "Unknown user"}
                        </span>
                        {entry.editedBy?.email ? (
                          <span className="text-textSecondary">
                            {" "}
                            ({entry.editedBy.email})
                          </span>
                        ) : null}
                      </p>
                      {entry.changes?.description && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-textSecondary uppercase tracking-wide mb-1">
                            Description
                          </p>
                          <p className="text-textPrimary break-words">
                            <span className="line-through opacity-70">
                              {String(entry.changes.description.from ?? "—")}
                            </span>
                            <span className="text-textSecondary mx-1">→</span>
                            <span>
                              {String(entry.changes.description.to ?? "—")}
                            </span>
                          </p>
                        </div>
                      )}
                      {entry.changes?.amount && (
                        <div>
                          <p className="text-xs font-medium text-textSecondary uppercase tracking-wide mb-1">
                            Amount
                          </p>
                          <p className="text-textPrimary">
                            ₹{formatMoney(entry.changes.amount.from)} → ₹
                            {formatMoney(entry.changes.amount.to)}
                          </p>
                        </div>
                      )}
                      {entry.changes &&
                        !entry.changes.description &&
                        !entry.changes.amount && (
                          <p className="text-textSecondary text-xs">
                            (Other fields updated)
                          </p>
                        )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
