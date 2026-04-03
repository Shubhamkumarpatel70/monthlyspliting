import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { admin as adminApi } from "../../api";

const formatMoney = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "0.00";

const expenseCategoryLabel = (ex) =>
  ex.category === "Custom" && ex.customCategory
    ? ex.customCategory
    : ex.category || "—";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to load statistics");
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

  const totalUsers = stats?.users?.total ?? 0;
  const verifiedUsers = stats?.users?.verified ?? 0;
  const unverifiedUsers = Math.max(0, totalUsers - verifiedUsers);
  const expenseTotalAmount = stats?.expenses?.totalAmount ?? 0;
  const recentExpenses = Array.isArray(stats?.expenses?.recent)
    ? stats.expenses.recent
    : [];
  const recentUsers = Array.isArray(stats?.users?.recent)
    ? stats.users.recent
    : [];

  const statCards = [
    {
      title: "Total users",
      value: totalUsers,
      subtitle: `${stats?.users?.active || 0} active`,
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      link: "/admin/users",
    },
    {
      title: "Verified users",
      value: verifiedUsers,
      subtitle: `${unverifiedUsers} unverified`,
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "bg-green-500/20 text-green-400 border-green-500/30",
      link: "/admin/users?status=verified",
    },
    {
      title: "Groups",
      value: stats?.groups?.total || 0,
      subtitle: "Households / shared ledgers",
      icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
      color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      link: "/admin/groups",
    },
    {
      title: "Expenses (records)",
      value: stats?.expenses?.total || 0,
      subtitle: `₹${formatMoney(expenseTotalAmount)} recorded total`,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      link: "/admin/expenses",
    },
    {
      title: "Active OTPs",
      value: stats?.otps?.active || 0,
      subtitle: `${stats?.otps?.total || 0} total`,
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      link: "/admin/otps?verified=false",
    },
  ];

  const quickLinks = [
    {
      to: "/admin/expenses",
      label: "All expenses",
      hint: "Search & filter system-wide",
      accent: "border-orange-500/25 bg-orange-500/5",
    },
    {
      to: "/admin/transactions",
      label: "Payments",
      hint: "Settlement transfers",
      accent: "border-emerald-500/25 bg-emerald-500/5",
    },
    {
      to: "/admin/groups",
      label: "Groups",
      hint: "Manage households",
      accent: "border-violet-500/25 bg-violet-500/5",
    },
    {
      to: "/admin/users",
      label: "Users",
      hint: "Accounts & roles",
      accent: "border-sky-500/25 bg-sky-500/5",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">Admin dashboard</h1>
          <p className="text-textSecondary text-sm mt-2 max-w-xl">
            Platform overview for Monthly Split — user growth, groups, expense
            volume, and OTP health.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          className="self-start sm:self-auto px-4 py-2 rounded-lg border border-white/15 text-textSecondary text-sm hover:bg-white/5 hover:text-textPrimary transition"
        >
          Refresh data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-surface rounded-2xl border border-white/5 p-6 hover:border-primary/30 transition group"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center border`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={card.icon}
                  />
                </svg>
              </div>
              <svg
                className="w-5 h-5 text-textSecondary group-hover:text-primary transition"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <h3 className="text-textSecondary text-sm font-medium mb-1">
              {card.title}
            </h3>
            <p className="text-3xl font-bold text-textPrimary mb-1">
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </p>
            <p className="text-textSecondary text-xs">{card.subtitle}</p>
          </Link>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-textSecondary mb-3">
          Shortcuts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-xl border p-4 transition hover:border-primary/35 ${item.accent}`}
            >
              <p className="text-textPrimary font-semibold">{item.label}</p>
              <p className="text-textSecondary text-xs mt-1">{item.hint}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recentUsers.length > 0 && (
          <div className="bg-surface rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-textPrimary">
                Recent users
              </h2>
              <Link
                to="/admin/users"
                className="text-primary text-sm font-medium hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-darkBg border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-sm">
                        {(user.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-textPrimary font-medium text-sm truncate">
                        {user.name}
                      </p>
                      <p className="text-textSecondary text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {user.emailVerified && (
                      <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                        Verified
                      </span>
                    )}
                    <span className="text-textSecondary text-xs whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentExpenses.length > 0 && (
          <div className="bg-surface rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-textPrimary">
                Latest expenses
              </h2>
              <Link
                to="/admin/expenses"
                className="text-primary text-sm font-medium hover:underline"
              >
                Manage all
              </Link>
            </div>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="text-left text-textSecondary text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="pb-2 pr-2 font-medium">Description</th>
                    <th className="pb-2 pr-2 font-medium whitespace-nowrap">
                      Amount
                    </th>
                    <th className="pb-2 font-medium">Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentExpenses.map((ex) => (
                    <tr key={ex._id} className="text-textPrimary">
                      <td className="py-2.5 pr-2 align-top max-w-[140px]">
                        <span className="line-clamp-2">{ex.description}</span>
                        <span className="block text-[10px] text-textSecondary mt-0.5">
                          {expenseCategoryLabel(ex)} · {ex.month || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 align-top whitespace-nowrap font-semibold text-primary">
                        ₹{formatMoney(ex.amount)}
                      </td>
                      <td className="py-2.5 align-top text-textSecondary truncate max-w-[100px]">
                        {ex.group?.name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
