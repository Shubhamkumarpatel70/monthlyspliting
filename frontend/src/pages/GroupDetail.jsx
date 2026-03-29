import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  groups as groupsApi,
  expenses as expensesApi,
  payments as paymentsApi,
  advances as advancesApi,
  ai as aiApi,
} from "../api";
import { useAuth } from "../context/AuthContext";
import ExpenseForm from "../components/ExpenseForm";
import SettlementView from "../components/SettlementView";
import Charts from "../components/Charts";
import AiMonthSummaryLoader from "../components/AiMonthSummaryLoader";
import { useAiCooldown } from "../hooks/useAiCooldown";

const CATEGORIES = [
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

const toMoney = (value) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getCategoryPillClass = (category) => {
  const c = String(category || "").toLowerCase();
  if (c === "food") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (c === "groceries") return "bg-lime-500/15 text-lime-300 border-lime-500/25";
  if (c === "travel") return "bg-sky-500/15 text-sky-300 border-sky-500/25";
  if (c === "rent") return "bg-violet-500/15 text-violet-300 border-violet-500/25";
  if (c === "bills" || c === "utilities")
    return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (c === "shopping") return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25";
  if (c === "entertainment")
    return "bg-pink-500/15 text-pink-300 border-pink-500/25";
  if (c === "health") return "bg-red-500/15 text-red-300 border-red-500/25";
  if (c === "others") return "bg-slate-500/15 text-slate-200 border-slate-500/25";
  if (c === "misc") return "bg-slate-400/10 text-slate-200 border-slate-400/20";
  return "bg-white/5 text-textSecondary border-white/10";
};

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [balances, setBalances] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [payments, setPayments] = useState([]);
  const [advancesList, setAdvancesList] = useState([]);
  const [previousMonthBalances, setPreviousMonthBalances] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDesc, setAdvanceDesc] = useState("");

  const [editingAdvanceId, setEditingAdvanceId] = useState(null);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState("");
  const [editAdvanceDesc, setEditAdvanceDesc] = useState("");

  const [memberMobile, setMemberMobile] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");

  const [aiSummary, setAiSummary] = useState("");
  const [aiSummarySavings, setAiSummarySavings] = useState([]);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [aiForecast, setAiForecast] = useState(null);
  const [aiForecastLoading, setAiForecastLoading] = useState(false);
  const [aiForecastError, setAiForecastError] = useState("");
  const {
    onCooldown: aiSummaryOnCooldown,
    remainingSec: aiSummaryCooldownSec,
    startCooldown: startAiSummaryCooldown,
  } = useAiCooldown(45_000);

  const isAdmin = group?.members?.some(
    (m) =>
      (m.user?._id || m.user)?.toString() === user?._id?.toString() &&
      m.role === "admin",
  );

  const memberMap = useMemo(() => {
    const map = new Map();
    (group?.members || []).forEach((m) => {
      const id = (m.user?._id || m.user || m._id || m.id)?.toString();
      const name = m.user?.name || m.name || "Member";
      if (id) map.set(id, name);
    });
    return map;
  }, [group]);

  const loadGroup = async () => {
    try {
      const data = await groupsApi.get(groupId);
      setGroup(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load group");
      if (
        err.message?.includes("not found") ||
        err.message?.toLowerCase().includes("not a member")
      ) {
        navigate("/dashboard", { replace: true });
      }
    }
  };

  const loadMonths = async () => {
    try {
      const data = await expensesApi.months(groupId);
      setMonths(Array.isArray(data) ? data : []);
      const current = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      setSelectedMonth(
        (prev) =>
          prev || (Array.isArray(data) && data.length ? data[0] : current),
      );
    } catch {
      // ignore
    }
  };

  const loadExpenses = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.list(groupId, selectedMonth);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load expenses");
      setExpenses([]);
    }
  };

  const loadBalances = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.balances(groupId, selectedMonth);
      setBalances(data || null);
    } catch {
      setBalances(null);
    }
  };

  const loadPayments = async () => {
    if (!selectedMonth) return;
    try {
      const data = await paymentsApi.list(groupId, selectedMonth);
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    }
  };

  const loadAdvances = async () => {
    if (!selectedMonth) return;
    try {
      const data = await advancesApi.list(groupId, selectedMonth);
      setAdvancesList(Array.isArray(data) ? data : []);
    } catch {
      setAdvancesList([]);
    }
  };

  const loadSettlement = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.settlement(groupId, selectedMonth);
      setSettlement(data || null);
    } catch {
      setSettlement(null);
    }
  };

  const getPreviousMonth = (yyyyMm) => {
    if (!yyyyMm) return null;
    const [y, m] = yyyyMm.split("-").map(Number);
    if (!y || !m) return null;
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, "0")}`;
  };

  const loadPreviousMonthBalances = async () => {
    if (!selectedMonth) return;
    const prev = getPreviousMonth(selectedMonth);
    if (!prev) return;
    try {
      const data = await expensesApi.balances(groupId, prev);
      setPreviousMonthBalances(data || null);
    } catch {
      setPreviousMonthBalances(null);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    if (!group) return;
    loadMonths();
  }, [group?._id]);

  useEffect(() => {
    if (!group || !selectedMonth) return;
    setLoading(true);
    setPreviousMonthBalances(null);

    Promise.all([
      loadExpenses(),
      loadBalances(),
      loadSettlement(),
      loadPayments(),
      loadAdvances(),
      loadPreviousMonthBalances(),
    ]).finally(() => setLoading(false));
  }, [groupId, selectedMonth, group?._id]);

  useEffect(() => {
    setAiSummary("");
    setAiSummarySavings([]);
    setAiSummaryError("");
    setAiForecast(null);
    setAiForecastError("");
  }, [selectedMonth, groupId]);

  useEffect(() => {
    if (!groupId || !group) return;

    const POLL_MS = 8000;

    const poll = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      loadGroup();
      loadMonths();

      if (selectedMonth) {
        loadExpenses();
        loadBalances();
        loadSettlement();
        loadPayments();
        loadAdvances();
        loadPreviousMonthBalances();
      }
    };

    const intervalId = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalId);
  }, [groupId, group?._id, selectedMonth]);

  const refresh = () => {
    loadGroup();
    loadMonths();
    if (selectedMonth) {
      loadExpenses();
      loadBalances();
      loadSettlement();
      loadPayments();
      loadAdvances();
      loadPreviousMonthBalances();
    }
  };

  const handleAiMonthSummary = async () => {
    if (!groupId || !selectedMonth || aiSummaryOnCooldown) return;
    setAiSummaryLoading(true);
    setAiSummaryError("");
    try {
      const res = await aiApi.monthSummary({
        groupId,
        month: selectedMonth,
      });
      setAiSummary(res.summary || "");
      setAiSummarySavings(
        Array.isArray(res.savingsIdeas) ? res.savingsIdeas : [],
      );
      startAiSummaryCooldown(45_000);
    } catch (err) {
      setAiSummary("");
      setAiSummarySavings([]);
      const msg = err.message || "Failed to generate summary.";
      setAiSummaryError(msg);
      if (/429|rate limit|too many/i.test(msg)) {
        startAiSummaryCooldown(90_000);
      } else {
        startAiSummaryCooldown(30_000);
      }
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleForecastNextMonth = async () => {
    if (!groupId) return;
    setAiForecastLoading(true);
    setAiForecastError("");
    try {
      const res = await aiApi.forecastNextMonth({ groupId });
      setAiForecast(res || null);
    } catch (err) {
      setAiForecast(null);
      setAiForecastError(err.message || "Failed to forecast next month.");
    } finally {
      setAiForecastLoading(false);
    }
  };

  const handleExport = async () => {
    if (!groupId || !selectedMonth) return;

    const backendUrl =
      window.location.hostname === "localhost" ? "http://localhost:5000" : "";
    const url = `${backendUrl}/api/groups/${groupId}/export?month=${encodeURIComponent(selectedMonth)}`;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to export CSV");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `report-${selectedMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || "Failed to export CSV");
    }
  };

  const handleConfirmPayment = async (paymentId) => {
    try {
      await paymentsApi.confirm(groupId, paymentId);
      refresh();
    } catch (err) {
      setError(err.message || "Failed to confirm payment");
    }
  };

  const handleRejectPayment = async (paymentId) => {
    if (!window.confirm("Are you sure the payment was not received?")) return;

    try {
      await paymentsApi.reject(groupId, paymentId, "Payment not received");
      refresh();
    } catch (err) {
      setError(err.message || "Failed to reject payment");
    }
  };

  const handleAddExpense = async (payload) => {
    try {
      await expensesApi.create(groupId, payload);
      setAddExpenseOpen(false);
      refresh();
    } catch (err) {
      setError(err.message || "Failed to add expense");
    }
  };

  const handleUpdateExpense = async (expenseId, payload) => {
    try {
      await expensesApi.update(groupId, expenseId, payload);
      setEditingExpense(null);
      refresh();
    } catch (err) {
      setError(err.message || "Failed to update expense");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      await expensesApi.delete(groupId, expenseId);
      setEditingExpense(null);
      refresh();
    } catch (err) {
      setError(err.message || "Failed to delete expense");
    }
  };

  // Advance = external group credit, not paid by any member
  const handleAddAdvance = async (e) => {
    e.preventDefault();

    const amt = parseFloat(advanceAmount);
    if (!amt || amt < 0.01) {
      setError("Enter a valid advance amount");
      return;
    }

    try {
      await advancesApi.create(groupId, {
        amount: amt,
        month: selectedMonth,
        description: advanceDesc.trim(),
        type: "external_credit",
      });

      setAddAdvanceOpen(false);
      setAdvanceAmount("");
      setAdvanceDesc("");
      refresh();
    } catch (err) {
      setError(err.message || "Failed to add advance");
    }
  };

  const handleDeleteAdvance = async (advanceId) => {
    if (!window.confirm("Delete this advance?")) return;

    try {
      await advancesApi.delete(groupId, advanceId);
      refresh();
    } catch (err) {
      setError(err.message || "Failed to delete advance");
    }
  };

  const handleEditAdvance = (adv) => {
    setEditingAdvanceId(adv._id);
    setEditAdvanceAmount(String(adv.amount ?? ""));
    setEditAdvanceDesc(adv.description || "");
  };

  const handleSaveAdvance = async () => {
    const amt = parseFloat(editAdvanceAmount);
    if (!amt || amt < 0.01) {
      setError("Enter a valid advance amount");
      return;
    }

    try {
      await advancesApi.update(groupId, editingAdvanceId, {
        amount: amt,
        description: editAdvanceDesc.trim(),
        type: "external_credit",
      });

      setEditingAdvanceId(null);
      setEditAdvanceAmount("");
      setEditAdvanceDesc("");
      refresh();
    } catch (err) {
      setError(err.message || "Failed to update advance");
    }
  };

  const handleCancelEditAdvance = () => {
    setEditingAdvanceId(null);
    setEditAdvanceAmount("");
    setEditAdvanceDesc("");
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const mobile = memberMobile.replace(/\D/g, "").trim();
    if (!mobile) return;

    setError("");

    try {
      await groupsApi.addMember(groupId, mobile);
      setMemberMobile("");
      setAddMemberOpen(false);
      loadGroup();
    } catch (err) {
      setError(err.message || "Failed to add member");
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/join/${groupId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from the group?")) return;

    try {
      await groupsApi.removeMember(groupId, userId);
      loadGroup();
      refresh();
    } catch (err) {
      setError(err.message || "Failed to remove member");
    }
  };

  const handleSettlementStatus = async (status) => {
    try {
      await expensesApi.settlementStatus(groupId, selectedMonth, status);
      loadSettlement();
    } catch (err) {
      setError(err.message || "Failed to update settlement status");
    }
  };

  const handleEditGroupName = async (e) => {
    e?.preventDefault?.();
    const name = editGroupName?.trim();
    if (!name) return;

    try {
      await groupsApi.update(groupId, { name });
      setEditNameOpen(false);
      setEditGroupName("");
      loadGroup();
    } catch (err) {
      setError(err.message || "Failed to update group name");
    }
  };

  const handleDeleteGroup = async () => {
    if (
      !window.confirm(
        "Delete this group? All expenses and data will be permanently removed.",
      )
    ) {
      return;
    }

    try {
      await groupsApi.delete(groupId);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to delete group");
    }
  };

  const settlementStatus = settlement?.status ?? "pending";
  const canAddExpense = settlementStatus === "pending";

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const monthOptions = [...new Set([...months, currentMonthStr])]
    .sort()
    .reverse();

  const displayMonth = selectedMonth
    ? (() => {
        const [y, m] = selectedMonth.split("-");
        return format(
          new Date(parseInt(y, 10), parseInt(m, 10) - 1),
          "MMMM yyyy",
        );
      })()
    : "";

  const totalExpense = safeNumber(balances?.totalExpense);
  const totalAdvance = safeNumber(balances?.totalAdvance);
  const originalShare = safeNumber(balances?.originalShare);
  const advanceShare = safeNumber(balances?.advanceShare);
  const finalShare = Math.max(0, safeNumber(balances?.finalShare));
  const surplusCredit = Math.max(
    0,
    safeNumber(
      balances?.surplusCredit,
      totalAdvance > totalExpense ? totalAdvance - totalExpense : 0,
    ),
  );

  const memberCount = group?.members?.length || 0;
  const isSingleMember = memberCount === 1;
  const showSettlementView = memberCount > 1;

  // Map per-member transfer info from settlement:
  // how much each member pays / receives and primary counterparty name.
  const memberTransfers = useMemo(() => {
    const map = {};
    const txns =
      settlement?.transactionsWithNames ?? settlement?.transactions ?? [];
    if (!Array.isArray(txns)) return map;

    txns.forEach((t) => {
      const fromId = (t.from?._id || t.from || "").toString();
      const toId = (t.to?._id || t.to || "").toString();
      const amount = Number(t.amount) || 0;
      if (!amount || !fromId || !toId) return;

      if (!map[fromId]) {
        map[fromId] = {
          paysTotal: 0,
          paysTo: [],
          getsTotal: 0,
          getsFrom: [],
        };
      }
      if (!map[toId]) {
        map[toId] = {
          paysTotal: 0,
          paysTo: [],
          getsTotal: 0,
          getsFrom: [],
        };
      }

      map[fromId].paysTotal += amount;
      map[fromId].paysTo.push(t.toName || memberMap.get(toId) || "Member");

      map[toId].getsTotal += amount;
      map[toId].getsFrom.push(t.fromName || memberMap.get(fromId) || "Member");
    });

    return map;
  }, [settlement, memberMap]);

  if (!group) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      <div className="flex flex-col gap-4">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-textSecondary hover:text-primary text-sm mb-2 flex items-center gap-1 touch-manipulation"
          >
            ← Back to dashboard
          </button>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-textPrimary break-words">
                {group.name}
              </h1>
              <p className="text-textSecondary text-sm mt-1">
                {group.members?.length || 0} members
              </p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditGroupName(group.name);
                    setEditNameOpen(true);
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-textSecondary text-sm hover:border-primary/30 hover:text-primary touch-manipulation"
                >
                  Edit name
                </button>

                <button
                  onClick={handleDeleteGroup}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm hover:bg-danger/20 touch-manipulation"
                >
                  Delete group
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col xs:flex-row flex-wrap gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-auto min-w-0 px-4 py-3 sm:py-2.5 rounded-xl bg-surface border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
          >
            <option value="">Select month</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {(() => {
                  const [y, mo] = m.split("-");
                  return format(
                    new Date(parseInt(y, 10), parseInt(mo, 10) - 1),
                    "MMMM yyyy",
                  );
                })()}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={!selectedMonth}
            className="min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl bg-surface border border-primary/30 text-primary font-semibold touch-manipulation"
          >
            <svg
              className="w-5 h-5 mr-2 inline"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
            Export monthly CSV
          </button>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => canAddExpense && setAddExpenseOpen(true)}
              disabled={!canAddExpense}
              title={
                !canAddExpense
                  ? "Settlement marked as paid. Reset to pending to add expenses."
                  : undefined
              }
              className={`flex-1 sm:flex-none min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl font-semibold touch-manipulation ${
                canAddExpense
                  ? "bg-primary text-darkBg hover:bg-primary/90"
                  : "bg-white/10 text-textSecondary cursor-not-allowed"
              }`}
            >
              Add expense
            </button>

            <button
              onClick={handleShare}
              className="min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl bg-surface border border-white/10 text-textPrimary hover:border-primary/30 touch-manipulation flex items-center gap-2"
            >
              {shareCopied ? (
                <>
                  <svg
                    className="w-5 h-5 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Link copied
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                    />
                  </svg>
                  Share
                </>
              )}
            </button>

            <button
              onClick={() => canAddExpense && setAddAdvanceOpen(true)}
              disabled={!canAddExpense}
              className={`flex-1 sm:flex-none min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl font-semibold touch-manipulation ${
                canAddExpense
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-white/10 text-textSecondary cursor-not-allowed"
              }`}
            >
              Add advance
            </button>

            {isAdmin && (
              <button
                onClick={() => setAddMemberOpen(true)}
                className="min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl bg-surface border border-white/10 text-textPrimary hover:border-primary/30 touch-manipulation"
              >
                Add member
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-danger/80 hover:text-danger"
          >
            ×
          </button>
        </div>
      )}

      {addMemberOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setAddMemberOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-textPrimary mb-4">
              Add member
            </h2>

            <p className="text-textSecondary text-sm mb-3">
              They must have signed up with this mobile number first.
            </p>

            <form onSubmit={handleAddMember}>
              <input
                type="tel"
                inputMode="numeric"
                value={memberMobile}
                onChange={(e) =>
                  setMemberMobile(
                    e.target.value.replace(/\D/g, "").slice(0, 15),
                  )
                }
                placeholder="10-digit mobile number"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                maxLength={15}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editNameOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setEditNameOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-textPrimary mb-4">
              Edit group name
            </h2>

            <form onSubmit={handleEditGroupName}>
              <input
                type="text"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                required
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditNameOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addExpenseOpen && (
        <ExpenseForm
          group={group}
          defaultMonth={selectedMonth}
          categories={CATEGORIES}
          onSave={handleAddExpense}
          onCancel={() => setAddExpenseOpen(false)}
        />
      )}

      {editingExpense && (
        <ExpenseForm
          group={group}
          expense={editingExpense}
          categories={CATEGORIES}
          onSave={(payload) => handleUpdateExpense(editingExpense._id, payload)}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {addAdvanceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setAddAdvanceOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-textPrimary mb-4">
              Add Advance
            </h2>

            <form onSubmit={handleAddAdvance}>
              <label className="block text-textSecondary text-sm mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                min="0.01"
                step="0.01"
                required
              />

              <p className="text-textSecondary text-sm mb-3">
                Advance is external credit shared equally among all members.
              </p>

              <label className="block text-textSecondary text-sm mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={advanceDesc}
                onChange={(e) => setAdvanceDesc(e.target.value)}
                placeholder="e.g. Landlord discount / cashback / bonus"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddAdvanceOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!selectedMonth ? (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center text-textSecondary">
          Select a month or add an expense to get started.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div
            className={`grid gap-4 sm:grid-cols-2 ${surplusCredit > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
          >
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Total expense</p>
              <p className="text-2xl font-bold text-textPrimary mt-1">
                ₹{toMoney(totalExpense)}
              </p>
              <p className="text-textSecondary text-xs mt-1">{displayMonth}</p>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Total advance</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{toMoney(totalAdvance)}
              </p>
              <p className="text-textSecondary text-xs mt-1">
                Advance per member: ₹{toMoney(advanceShare)}
              </p>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Original share</p>
              <p className="text-2xl font-bold text-primary mt-1">
                ₹{toMoney(originalShare)}
              </p>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Final share</p>
              <p className="text-2xl font-bold text-primary mt-1">
                ₹{toMoney(finalShare)}
              </p>
              {totalAdvance > 0 && (
                <>
                  <p className="text-textSecondary text-xs mt-1">
                    Final share = Original share − Advance per member
                  </p>
                  <p className="text-textSecondary text-xs mt-1">
                    ₹{toMoney(originalShare)} − ₹{toMoney(advanceShare)} = ₹
                    {toMoney(finalShare)}
                  </p>
                </>
              )}
            </div>

            {isSingleMember && totalAdvance > 0 && (
              <div className="bg-surface rounded-2xl border border-white/5 p-5">
                <p className="text-textSecondary text-sm">You saved</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  ₹{toMoney(advanceShare)}
                </p>
              </div>
            )}

            {surplusCredit > 0 && (
              <div className="bg-surface rounded-2xl border border-white/5 p-5">
                <p className="text-textSecondary text-sm">Surplus credit</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  ₹{toMoney(surplusCredit)}
                </p>
                <p className="text-textSecondary text-xs mt-1">
                  {isSingleMember
                    ? "Carry forward to next month"
                    : "Carry forward / wallet balance"}
                </p>
              </div>
            )}

            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Settlement</p>
              <p className="text-textPrimary text-sm mt-1 capitalize">
                {settlement?.status || "pending"}
              </p>
            </div>
          </div>

          {balances && (
            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
              <h2 className="text-lg font-semibold text-textPrimary px-4 sm:px-5 py-4 border-b border-white/5">
                Balances before and after advance
              </h2>

              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Member
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Paid
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Share
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Original Net
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Advance Credit
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Net (Paid − share)
                      </th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(balances.balances || {}).map(
                      ([id, obj]) => {
                        const name = memberMap.get(id.toString()) || "Member";
                        const paid = safeNumber(obj.paid);
                        const originalNet = safeNumber(obj.originalNet);
                        const rowShare = safeNumber(finalShare);
                        const rowAdvanceShare = safeNumber(
                          obj.advanceShare,
                          advanceShare,
                        );
                        const rowAdvanceReceived = safeNumber(
                          obj.advanceReceived,
                          0,
                        );
                        const finalNet = safeNumber(obj.finalNet);

                        const transfer = memberTransfers[id.toString()];
                        const paysTotal = safeNumber(transfer?.paysTotal);
                        const getsTotal = safeNumber(transfer?.getsTotal);
                        const paysToNames = Array.isArray(transfer?.paysTo)
                          ? [...new Set(transfer.paysTo)]
                          : [];
                        const getsFromNames = Array.isArray(transfer?.getsFrom)
                          ? [...new Set(transfer.getsFrom)]
                          : [];

                        return (
                          <tr
                            key={id}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="px-3 sm:px-5 py-3 text-textPrimary font-medium">
                              {name}
                            </td>

                            <td className="px-3 sm:px-5 py-3 text-right text-textSecondary text-sm">
                              ₹{toMoney(paid)}
                            </td>

                          <td className="px-3 sm:px-5 py-3 text-right text-textSecondary text-sm">
                            ₹{toMoney(rowShare)}
                          </td>

                            <td
                              className={`px-3 sm:px-5 py-3 text-right text-sm ${
                                originalNet > 0
                                  ? "text-success"
                                  : originalNet < 0
                                    ? "text-danger"
                                    : "text-textSecondary"
                              }`}
                            >
                              {originalNet > 0 ? "+" : ""}₹
                              {toMoney(originalNet)}
                            </td>

                            <td className="px-3 sm:px-5 py-3 text-right text-success text-sm">
                              +₹{toMoney(rowAdvanceShare)}
                            </td>

                            <td
                              className={`px-3 sm:px-5 py-3 text-right font-medium text-sm ${
                                finalNet > 0
                                  ? "text-success"
                                  : finalNet < 0
                                    ? "text-danger"
                                    : "text-textSecondary"
                              }`}
                            >
                              {finalNet > 0 ? "+" : ""}₹{toMoney(finalNet)}
                            </td>

                            <td className="px-3 sm:px-5 py-3 text-right text-sm">
                              {(() => {
                                // Keep Status simple and easy to read.
                                if (finalNet > 0) {
                                  return (
                                    <span className="text-success">
                                      Credit ₹{toMoney(finalNet)}
                                    </span>
                                  );
                                }

                                if (finalNet < 0) {
                                  return (
                                    <span className="text-danger">
                                      Pay ₹{toMoney(Math.abs(finalNet))}
                                    </span>
                                  );
                                }

                                const zeroLabel = isSingleMember
                                  ? "No dues"
                                  : "Settled";
                                return (
                                  <span className="text-textSecondary">
                                    {zeroLabel}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {surplusCredit > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
              <p className="text-emerald-300 font-medium">
                All current month expenses are fully covered by advance.
              </p>
              <p className="text-textSecondary text-sm mt-1">
                Extra credit of ₹{toMoney(surplusCredit)} should be carried
                forward or stored as wallet balance.
              </p>
            </div>
          )}

          {showSettlementView ? (
            <SettlementView
              settlement={settlement}
              onStatusChange={handleSettlementStatus}
              isAdmin={isAdmin}
              groupId={groupId}
              month={selectedMonth}
              currentUserId={user?._id}
              payments={payments}
              onPaymentComplete={refresh}
              onConfirmPayment={handleConfirmPayment}
              onRejectPayment={handleRejectPayment}
            />
          ) : (
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <h2 className="text-lg font-semibold text-textPrimary mb-2">
                Settlement
              </h2>
              <p className="text-textSecondary text-sm">
                No settlement needed for single-member group.
              </p>
            </div>
          )}

          {Array.isArray(expenses) && expenses.length > 0 && (
            <Charts
              expenses={expenses}
              group={group}
              balances={balances}
              selectedMonth={selectedMonth}
              previousMonthBalances={previousMonthBalances}
            />
          )}

          {selectedMonth && (
            <div className="bg-surface rounded-2xl border border-primary/20 p-5">
              <h2 className="text-lg font-semibold text-textPrimary mb-1">
                AI month summary
              </h2>
              <p className="text-textSecondary text-sm mb-4">
                Insights for the selected month using your group&apos;s expenses
                and balances (not financial advice).
              </p>
              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAiMonthSummary}
                disabled={aiSummaryLoading || aiSummaryOnCooldown}
                className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary text-sm font-medium border border-primary/30 hover:bg-primary/25 disabled:opacity-60 flex items-center gap-2 min-w-[11rem] justify-center"
              >
                {aiSummaryLoading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-primary shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating…
                  </>
                ) : aiSummaryOnCooldown ? (
                  `Wait ${aiSummaryCooldownSec}s`
                ) : (
                  "Generate summary"
                )}
              </button>
              <button
                type="button"
                onClick={handleForecastNextMonth}
                disabled={aiForecastLoading}
                className="px-4 py-2.5 rounded-lg bg-surface border border-white/10 text-textPrimary text-sm font-medium hover:border-primary/30 disabled:opacity-60"
              >
                {aiForecastLoading ? "Forecasting…" : "Forecast next month"}
              </button>
              </div>
              {aiSummaryOnCooldown && !aiSummaryLoading && (
                <p className="mt-2 text-xs text-textSecondary">
                  Short pause between AI requests helps avoid rate limits (429).
                </p>
              )}
              {aiSummaryLoading && <AiMonthSummaryLoader />}
              {aiSummaryError && !aiSummaryLoading && (
                <p className="mt-3 text-sm text-danger">{aiSummaryError}</p>
              )}
              {aiForecastError && !aiForecastLoading && (
                <p className="mt-3 text-sm text-danger">{aiForecastError}</p>
              )}
              {aiForecast && (
                <div className="mt-4 rounded-xl border border-white/10 bg-darkBg/40 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-textSecondary mb-2">
                    Upcoming month estimate
                  </h3>
                  <p className="text-sm text-textPrimary">
                    Estimated <span className="font-semibold">{aiForecast.nextMonth}</span>{" "}
                    total: <span className="text-primary font-semibold">₹{toMoney(aiForecast.forecast)}</span>
                  </p>
                  {aiForecast?.basis?.months?.length === 2 && (
                    <p className="text-xs text-textSecondary mt-1">
                      Based on {aiForecast.basis.months[0]} (₹{toMoney(aiForecast.basis.totals?.[0])}) →{" "}
                      {aiForecast.basis.months[1]} (₹{toMoney(aiForecast.basis.totals?.[1])})
                      {aiForecast.basis.percentChange != null ? `, change ${aiForecast.basis.percentChange}%` : ""}.
                    </p>
                  )}
                </div>
              )}
              {aiSummary && (
                <div
                  className={`mt-4 border-t border-white/10 pt-4 transition-opacity duration-200 space-y-4 ${
                    aiSummaryLoading ? "opacity-50 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-textSecondary mb-2">
                      Overview
                    </h3>
                    <p className="text-sm text-textPrimary leading-relaxed whitespace-pre-wrap">
                      {aiSummary}
                    </p>
                  </div>
                  {Array.isArray(aiSummarySavings) && aiSummarySavings.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90 mb-2">
                        Where to save next month
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-textPrimary leading-relaxed marker:text-emerald-500/80">
                        {aiSummarySavings.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-textPrimary flex items-baseline flex-wrap gap-x-2 gap-y-0">
                Expense ledger
                {Array.isArray(expenses) && expenses.length > 0 && (
                  <span className="text-sm font-normal text-textSecondary">
                    {expenses.length} in {displayMonth}
                  </span>
                )}
              </h2>

              {canAddExpense && (
                <button
                  onClick={() => setAddExpenseOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 flex items-center gap-1.5"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </button>
              )}
            </div>

            {!canAddExpense && (
              <p className="px-4 sm:px-5 py-3 text-warning/90 text-sm border-b border-white/5">
                Settlement is marked as paid. Reset to pending to add more
                expenses.
              </p>
            )}

            {!Array.isArray(expenses) || expenses.length === 0 ? (
              <div className="px-4 sm:px-5 py-8 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-textSecondary/50 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
                  />
                </svg>

                <p className="text-textSecondary text-sm">
                  No expenses this month.
                </p>

                {canAddExpense && (
                  <button
                    onClick={() => setAddExpenseOpen(true)}
                    className="mt-3 px-4 py-2 rounded-lg bg-primary text-darkBg text-sm font-semibold hover:bg-primary/90"
                  >
                    Add first expense
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {expenses.map((ex) => (
                  <li
                    key={ex._id}
                    className="px-4 sm:px-5 py-3 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-white/5 active:bg-white/10 min-h-[52px]"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-textPrimary font-medium block truncate">
                        {ex.description}
                      </span>
                      <span className="text-textSecondary text-xs sm:text-sm">
                        {ex.payer?.name ?? "Unknown"} ·{" "}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] sm:text-xs leading-5 ${getCategoryPillClass(
                            ex.category === "Custom" && ex.customCategory
                              ? ex.customCategory
                              : ex.category,
                          )}`}
                        >
                          {ex.category === "Custom" && ex.customCategory
                            ? ex.customCategory
                            : ex.category}
                        </span>{" "}
                        · {format(new Date(ex.date), "dd MMM")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-primary font-semibold">
                        ₹{toMoney(ex.amount)}
                      </span>

                      <button
                        type="button"
                        onClick={() => canAddExpense && setEditingExpense(ex)}
                        disabled={!canAddExpense}
                        title={
                          !canAddExpense
                            ? "Can't edit - settlement is paid"
                            : "Edit expense"
                        }
                        className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-sm touch-manipulation ${
                          canAddExpense
                            ? "text-textSecondary hover:text-primary hover:bg-white/5"
                            : "text-textSecondary/40 cursor-not-allowed"
                        }`}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          canAddExpense && handleDeleteExpense(ex._id)
                        }
                        disabled={!canAddExpense}
                        title={
                          !canAddExpense
                            ? "Can't delete - settlement is paid"
                            : "Delete expense"
                        }
                        className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-sm touch-manipulation ${
                          canAddExpense
                            ? "text-danger hover:bg-danger/10"
                            : "text-danger/40 cursor-not-allowed"
                        }`}
                      >
                        Del
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-textPrimary">
                Advances
              </h2>

              {canAddExpense && (
                <button
                  onClick={() => setAddAdvanceOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 flex items-center gap-1.5"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </button>
              )}
            </div>

            {!Array.isArray(advancesList) || advancesList.length === 0 ? (
              <div className="px-4 sm:px-5 py-8 text-center">
                <p className="text-textSecondary text-sm">
                  No advances this month.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {advancesList.map((adv) => (
                  <li
                    key={adv._id}
                    className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-white/5 min-h-[52px]"
                  >
                    {editingAdvanceId === adv._id ? (
                      <>
                        <div className="flex-1 min-w-0 space-y-2">
                          <input
                            type="text"
                            value={editAdvanceDesc}
                            onChange={(e) => setEditAdvanceDesc(e.target.value)}
                            placeholder="Description"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-textPrimary text-sm"
                          />

                          <input
                            type="number"
                            value={editAdvanceAmount}
                            onChange={(e) =>
                              setEditAdvanceAmount(e.target.value)
                            }
                            placeholder="Amount"
                            step="0.01"
                            min="0.01"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-textPrimary text-sm"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleSaveAdvance}
                            className="min-h-[36px] px-3 rounded-lg text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelEditAdvance}
                            className="min-h-[36px] px-3 rounded-lg text-sm text-textSecondary hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="text-textPrimary font-medium block truncate">
                            {adv.description || "External credit"}
                          </span>
                          <span className="text-textSecondary text-xs sm:text-sm">
                            External credit ·{" "}
                            {format(new Date(adv.createdAt), "dd MMM")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-emerald-400 font-semibold">
                            ₹{toMoney(adv.amount)}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              canAddExpense && handleEditAdvance(adv)
                            }
                            disabled={!canAddExpense}
                            className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-sm touch-manipulation ${
                              canAddExpense
                                ? "text-primary hover:bg-primary/10"
                                : "text-primary/40 cursor-not-allowed"
                            }`}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              canAddExpense && handleDeleteAdvance(adv._id)
                            }
                            disabled={!canAddExpense}
                            className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-sm touch-manipulation ${
                              canAddExpense
                                ? "text-danger hover:bg-danger/10"
                                : "text-danger/40 cursor-not-allowed"
                            }`}
                          >
                            Del
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <h2 className="text-lg font-semibold text-textPrimary mb-3">
                Members
              </h2>

              <ul className="space-y-2">
                {group.members?.map((m) => {
                  const u = m.user;
                  const uid = (u?._id || u)?.toString();
                  const isSelf = uid === user?._id?.toString();

                  return (
                    <li
                      key={uid}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <span className="text-textPrimary">
                          {u?.name || "Member"}
                        </span>
                        {m.role === "admin" && (
                          <span className="ml-2 text-xs text-primary">
                            Admin
                          </span>
                        )}
                        <span className="text-textSecondary text-sm block">
                          {u?.email}
                        </span>
                      </div>

                      {isAdmin && !isSelf && m.role !== "admin" && (
                        <button
                          onClick={() => handleRemoveMember(uid)}
                          className="text-danger text-sm hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {selectedMonth && (
        <button
          type="button"
          onClick={() => canAddExpense && setAddExpenseOpen(true)}
          disabled={!canAddExpense}
          aria-label={
            canAddExpense ? "Add expense" : "Reset to pending to add expenses"
          }
          className={`fixed bottom-6 right-6 w-14 h-14 sm:hidden rounded-full shadow-lg flex items-center justify-center touch-manipulation z-30 ${
            canAddExpense
              ? "bg-primary text-darkBg shadow-primary/30 hover:bg-primary/90 active:scale-95"
              : "bg-white/10 text-textSecondary cursor-not-allowed"
          }`}
        >
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
