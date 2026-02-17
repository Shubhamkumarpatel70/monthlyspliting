import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { groups as groupsApi, expenses as expensesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import ExpenseForm from '../components/ExpenseForm';
import SettlementView from '../components/SettlementView';
import Charts from '../components/Charts';

const CATEGORIES = ['Food', 'Rent', 'Utilities', 'Misc', 'Custom'];

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [balances, setBalances] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [previousMonthBalances, setPreviousMonthBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberMobile, setMemberMobile] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

  const isAdmin = group?.members?.some(m => (m.user?._id || m.user)?.toString() === user?._id && m.role === 'admin');

  const loadGroup = async () => {
    try {
      const data = await groupsApi.get(groupId);
      setGroup(data);
      setError('');
    } catch (err) {
      setError(err.message);
      if (err.message?.includes('not found') || err.message?.toLowerCase().includes('not a member')) {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  const loadMonths = async () => {
    try {
      const data = await expensesApi.months(groupId);
      setMonths(data);
      const current = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth((prev) => prev || (data.length ? data[0] : current));
    } catch (_) {}
  };

  const loadExpenses = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.list(groupId, selectedMonth);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setExpenses([]);
    }
  };

  const loadBalances = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.balances(groupId, selectedMonth);
      setBalances(data);
    } catch (_) {}
  };

  const loadSettlement = async () => {
    if (!selectedMonth) return;
    try {
      const data = await expensesApi.settlement(groupId, selectedMonth);
      setSettlement(data);
    } catch (_) {}
  };

  const getPreviousMonth = (yyyyMm) => {
    if (!yyyyMm) return null;
    const [y, m] = yyyyMm.split('-').map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  };

  const loadPreviousMonthBalances = async () => {
    if (!selectedMonth) return;
    const prev = getPreviousMonth(selectedMonth);
    if (!prev) return;
    try {
      const data = await expensesApi.balances(groupId, prev);
      setPreviousMonthBalances(data);
    } catch (_) {
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
      loadPreviousMonthBalances(),
    ]).finally(() => setLoading(false));
  }, [groupId, selectedMonth]);

  // Real-time: poll for updates so other members see changes
  useEffect(() => {
    if (!groupId || !group) return;
    const POLL_MS = 8000;
    let intervalId;
    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadGroup();
      loadMonths();
      if (selectedMonth) {
        loadExpenses();
        loadBalances();
        loadSettlement();
        loadPreviousMonthBalances();
      }
    };
    intervalId = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalId);
  }, [groupId, group?._id, selectedMonth]);

  const refresh = () => {
    loadGroup();
    loadMonths();
    if (selectedMonth) {
      loadExpenses();
      loadBalances();
      loadSettlement();
      loadPreviousMonthBalances();
    }
  };

  const handleAddExpense = async (payload) => {
    await expensesApi.create(groupId, payload);
    setAddExpenseOpen(false);
    refresh();
  };

  const handleUpdateExpense = async (expenseId, payload) => {
    await expensesApi.update(groupId, expenseId, payload);
    setEditingExpense(null);
    refresh();
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    await expensesApi.delete(groupId, expenseId);
    setEditingExpense(null);
    refresh();
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const mobile = memberMobile.replace(/\D/g, '').trim();
    if (!mobile) return;
    setError('');
    try {
      await groupsApi.addMember(groupId, mobile);
      setMemberMobile('');
      setAddMemberOpen(false);
      loadGroup();
    } catch (err) {
      setError(err.message);
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
    if (!confirm('Remove this member from the group?')) return;
    try {
      await groupsApi.removeMember(groupId, userId);
      loadGroup();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSettlementStatus = async (status) => {
    try {
      await expensesApi.settlementStatus(groupId, selectedMonth, status);
      loadSettlement();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditGroupName = async (e) => {
    e?.preventDefault?.();
    const name = editGroupName?.trim();
    if (!name) return;
    try {
      await groupsApi.update(groupId, { name });
      setEditNameOpen(false);
      setEditGroupName('');
      loadGroup();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Delete this group? All expenses and data will be permanently removed.')) return;
    try {
      await groupsApi.delete(groupId);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  if (!group) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthOptions = [...new Set([...months, currentMonthStr])].sort().reverse();
  const displayMonth = selectedMonth ? (() => {
    const [y, m] = selectedMonth.split('-');
    return format(new Date(parseInt(y, 10), parseInt(m, 10) - 1), 'MMMM yyyy');
  })() : '';

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      <div className="flex flex-col gap-4">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-textSecondary hover:text-primary text-sm mb-2 flex items-center gap-1 touch-manipulation">
            ← Back to dashboard
          </button>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-textPrimary break-words">{group.name}</h1>
              <p className="text-textSecondary text-sm mt-1">{group.members?.length || 0} members</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditGroupName(group.name); setEditNameOpen(true); }}
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
                  const [y, mo] = m.split('-');
                  return format(new Date(parseInt(y, 10), parseInt(mo, 10) - 1), 'MMMM yyyy');
                })()}
              </option>
            ))}
          </select>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setAddExpenseOpen(true)}
              className="flex-1 sm:flex-none min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl bg-primary text-darkBg font-semibold hover:bg-primary/90 touch-manipulation"
            >
              Add expense
            </button>
            <button
              onClick={handleShare}
              className="min-h-[44px] px-4 py-3 sm:py-2.5 rounded-xl bg-surface border border-white/10 text-textPrimary hover:border-primary/30 touch-manipulation flex items-center gap-2"
            >
              {shareCopied ? (
                <>
                  <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Link copied
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                  Share
                </>
              )}
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
          <button onClick={() => setError('')} className="text-danger/80 hover:text-danger">×</button>
        </div>
      )}

      {addMemberOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAddMemberOpen(false)}>
          <div className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Add member</h2>
            <p className="text-textSecondary text-sm mb-3">They must have signed up with this mobile number first.</p>
            <form onSubmit={handleAddMember}>
              <input
                type="tel"
                inputMode="numeric"
                value={memberMobile}
                onChange={(e) => setMemberMobile(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="10-digit mobile number"
                className="w-full px-4 py-3 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                maxLength={15}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddMemberOpen(false)} className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editNameOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditNameOpen(false)}>
          <div className="bg-surface rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Edit group name</h2>
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
                <button type="button" onClick={() => setEditNameOpen(false)} className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold">Save</button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Total expense</p>
              <p className="text-2xl font-bold text-textPrimary mt-1">
                {balances?.totalExpense != null ? `₹${Number(balances.totalExpense).toFixed(2)}` : '—'}
              </p>
              <p className="text-textSecondary text-xs mt-1">{displayMonth}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Per person share</p>
              <p className="text-2xl font-bold text-primary mt-1">
                {balances?.sharePerPerson != null ? `₹${Number(balances.sharePerPerson).toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Contributions</p>
              <p className="text-textPrimary text-sm mt-1 font-medium">See table below</p>
            </div>
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <p className="text-textSecondary text-sm">Settlement</p>
              <p className="text-textPrimary text-sm mt-1 capitalize">{settlement?.status || 'pending'}</p>
            </div>
          </div>

          {balances && (
            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
              <h2 className="text-lg font-semibold text-textPrimary px-4 sm:px-5 py-4 border-b border-white/5">Balance (paid − share)</h2>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[280px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">Member</th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">Paid</th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">Share</th>
                      <th className="text-right text-textSecondary text-sm font-medium px-3 sm:px-5 py-3">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(balances.balances || {}).map(([id, obj]) => {
                      const b = typeof obj === 'object' && obj !== null && 'balance' in obj ? obj.balance : obj;
                      let name = typeof obj === 'object' && obj !== null && obj.name ? obj.name : id;
                      if (name && name.length === 24 && /^[a-f0-9]+$/i.test(name)) name = 'Member';
                      const paid = balances.paidByUser?.[id] ?? 0;
                      const share = balances.sharePerPerson ?? 0;
                      return (
                        <tr key={id} className="border-b border-white/5 last:border-0">
                          <td className="px-3 sm:px-5 py-3 text-textPrimary font-medium">{name}</td>
                          <td className="px-3 sm:px-5 py-3 text-right text-textSecondary text-sm">₹{Number(paid).toFixed(2)}</td>
                          <td className="px-3 sm:px-5 py-3 text-right text-textSecondary text-sm">₹{Number(share).toFixed(2)}</td>
                          <td className={`px-3 sm:px-5 py-3 text-right font-medium text-sm ${b > 0 ? 'text-success' : b < 0 ? 'text-danger' : 'text-textSecondary'}`}>
                            {b > 0 ? '+' : ''}₹{Number(b).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <SettlementView
            settlement={settlement}
            onStatusChange={handleSettlementStatus}
            isAdmin={isAdmin}
          />

          {Array.isArray(expenses) && expenses.length > 0 && (
            <Charts
              expenses={expenses}
              group={group}
              balances={balances}
              selectedMonth={selectedMonth}
              previousMonthBalances={previousMonthBalances}
            />
          )}

          <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
            <h2 className="text-lg font-semibold text-textPrimary px-4 sm:px-5 py-4 border-b border-white/5">Expense ledger</h2>
            {!Array.isArray(expenses) || expenses.length === 0 ? (
              <p className="px-4 sm:px-5 py-8 text-textSecondary text-sm">No expenses this month. Tap Add expense to record one.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {expenses.slice(0, 30).map((ex) => (
                  <li key={ex._id} className="px-4 sm:px-5 py-3 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-white/5 active:bg-white/10 min-h-[52px]">
                    <div className="flex-1 min-w-0">
                      <span className="text-textPrimary font-medium block truncate">{ex.description}</span>
                      <span className="text-textSecondary text-xs sm:text-sm">
                        {ex.payer?.name ?? 'Unknown'} · {ex.category === 'Custom' && ex.customCategory ? ex.customCategory : ex.category} · {format(new Date(ex.date), 'dd MMM')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-primary font-semibold">₹{Number(ex.amount).toFixed(2)}</span>
                      <button type="button" onClick={() => setEditingExpense(ex)} className="min-h-[36px] min-w-[44px] px-2 rounded-lg text-textSecondary hover:text-primary hover:bg-white/5 text-sm touch-manipulation">Edit</button>
                      <button type="button" onClick={() => handleDeleteExpense(ex._id)} className="min-h-[36px] min-w-[44px] px-2 rounded-lg text-danger hover:bg-danger/10 text-sm touch-manipulation">Del</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <div className="bg-surface rounded-2xl border border-white/5 p-5">
              <h2 className="text-lg font-semibold text-textPrimary mb-3">Members</h2>
              <ul className="space-y-2">
                {group.members?.map((m) => {
                  const u = m.user;
                  const uid = u?._id || u;
                  const isSelf = uid?.toString() === user?._id;
                  return (
                    <li key={uid} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <span className="text-textPrimary">{u?.name}</span>
                        {m.role === 'admin' && <span className="ml-2 text-xs text-primary">Admin</span>}
                        <span className="text-textSecondary text-sm block">{u?.email}</span>
                      </div>
                      {isAdmin && !isSelf && m.role !== 'admin' && (
                        <button onClick={() => handleRemoveMember(uid)} className="text-danger text-sm hover:underline">Remove</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Floating Add expense button (mobile) */}
      {selectedMonth && (
        <button
          type="button"
          onClick={() => setAddExpenseOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 sm:hidden rounded-full bg-primary text-darkBg shadow-lg shadow-primary/30 flex items-center justify-center touch-manipulation z-30 hover:bg-primary/90 active:scale-95"
          aria-label="Add expense"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}
    </div>
  );
}
