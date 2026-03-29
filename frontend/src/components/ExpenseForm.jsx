import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ai as aiApi, expenses as expensesApi } from '../api';
import AIExpenseInput from './AIExpenseInput';

function matchMemberIdByName(group, name) {
  if (!name?.trim?.() || !group?.members?.length) return null;
  const lower = name.toLowerCase().trim();
  for (const m of group.members) {
    const u = m.user;
    const n = (u?.name || '').toLowerCase();
    if (!n) continue;
    if (n === lower || n.includes(lower) || lower.includes(n)) {
      const id = u?._id || u;
      return id != null ? String(id) : null;
    }
  }
  return null;
}

export default function ExpenseForm({ group, expense, defaultMonth, categories, onSave, onCancel }) {
  const isEdit = !!expense;
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense?.amount ?? '');
  const [date, setDate] = useState(expense?.date ? format(new Date(expense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [payerId, setPayerId] = useState(() => {
    const p = expense?.payer?._id || expense?.payer;
    return p != null ? String(p) : '';
  });
  const [category, setCategory] = useState(expense?.category ?? 'Misc');
  const [customCategory, setCustomCategory] = useState(expense?.customCategory ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(!!expense);
  const [nlSource, setNlSource] = useState('');
  const memberOptions = group?.members ?? [];
  const allMemberIds = memberOptions
    .map((m) => String(m.user?._id || m.user))
    .filter(Boolean);

  const [participants, setParticipants] = useState(() => {
    const parts = Array.isArray(expense?.participants)
      ? expense.participants.map((p) => String(p?._id || p))
      : [];
    return parts.length ? parts : allMemberIds;
  });
  const [splitType, setSplitType] = useState(expense?.splitType ?? 'equal');
  const [splitValues, setSplitValues] = useState(() => {
    const v = expense?.splitValues && typeof expense.splitValues === 'object'
      ? expense.splitValues
      : {};
    return { ...v };
  });

  useEffect(() => {
    if (!payerId && group?.members?.length) {
      const first = group.members[0].user?._id || group.members[0].user;
      setPayerId(first != null ? String(first) : '');
    }
  }, [group, payerId]);

  const applyParsed = (parsed, rawInput) => {
    setNlSource(rawInput || '');
    if (parsed.title) setDescription(parsed.title);
    if (parsed.amount != null && !Number.isNaN(Number(parsed.amount))) {
      setAmount(String(parsed.amount));
    }
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      setDate(parsed.date);
    }
    if (parsed.category) setCategory(parsed.category);
    setCategoryTouched(true);
    const matched = matchMemberIdByName(group, parsed.paidBy);
    if (matched) setPayerId(matched);
  };

  useEffect(() => {
    // If group loads late, default participants to all members
    if (!participants?.length && allMemberIds.length) {
      setParticipants(allMemberIds);
    }
  }, [allMemberIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleParticipant = (id) => {
    setParticipants((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = [...set];
      // keep at least 1
      return next.length ? next : prev;
    });
  };

  const setSplitValue = (userId, value) => {
    setSplitValues((prev) => ({ ...prev, [userId]: value }));
  };

  const groupId = group?._id;

  const submitExpense = async (skipDuplicate = false) => {
    const amt = parseFloat(amount);
    if (!description.trim() || isNaN(amt) || amt < 0.01) {
      setError('Description and a positive amount are required.');
      return;
    }
    setError('');
    if (!skipDuplicate && groupId) {
      setSaving(true);
      try {
        const { matches } = await expensesApi.checkDuplicate(groupId, {
          description: description.trim(),
          amount: amt,
          date: new Date(date).toISOString(),
          excludeExpenseId: expense?._id,
        });
        if (Array.isArray(matches) && matches.length > 0) {
          setDuplicateMatches(matches);
          return;
        }
      } catch {
        /* proceed if duplicate check fails */
      } finally {
        setSaving(false);
      }
    }

    setDuplicateMatches(null);
    setSaving(true);
    try {
      let finalCategory = category;
      let usedAiCategory = false;
      if (!isEdit && !categoryTouched && !nlSource && description.trim()) {
        try {
          const { category: suggested } = await aiApi.suggestCategory({
            title: description.trim(),
          });
          if (suggested) {
            finalCategory = suggested;
            usedAiCategory = true;
          }
        } catch {
          /* keep dropdown value */
        }
      }

      const finalParticipants = participants?.length ? participants : allMemberIds;
      if (!finalParticipants?.length) throw new Error('No participants selected.');

      await onSave({
        description: description.trim(),
        amount: amt,
        date: new Date(date).toISOString(),
        payer: payerId ? String(payerId) : undefined,
        category: finalCategory === 'Custom' ? 'Custom' : finalCategory,
        customCategory: finalCategory === 'Custom' ? customCategory : undefined,
        participants: finalParticipants,
        splitType,
        splitValues: splitType === 'equal' ? undefined : splitValues,
        aiGenerated: Boolean(nlSource) || usedAiCategory,
        aiRawInput: nlSource || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitExpense(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 overflow-y-auto" onClick={onCancel}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-xl mt-auto sm:mt-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-textPrimary mb-4">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
        {!isEdit && groupId && (
          <div className="mb-4">
            <AIExpenseInput groupId={groupId} onParsed={applyParsed} disabled={saving} />
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {duplicateMatches?.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/35 text-sm">
              <p className="font-medium text-amber-200/95 mb-2">
                Similar expense already exists (same description, amount, and date)
              </p>
              <ul className="text-textSecondary text-xs space-y-1.5 mb-3 list-disc list-inside">
                {duplicateMatches.map((m) => (
                  <li key={m._id}>
                    {m.description} · ₹{Number(m.amount).toFixed(2)} ·{' '}
                    {format(new Date(m.date), 'dd MMM yyyy')}
                    {m.payer?.name ? ` · ${m.payer.name}` : ''}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submitExpense(true)}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-amber-500/25 text-amber-100 text-sm font-medium hover:bg-amber-500/35 disabled:opacity-50"
                >
                  Save anyway
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateMatches(null)}
                  className="px-3 py-2 rounded-lg border border-white/15 text-textSecondary text-sm hover:bg-white/5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm text-textSecondary mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Groceries"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-textSecondary mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-textSecondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-textSecondary mb-1">Payer</label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {memberOptions.map((m) => {
                const u = m.user;
                const id = u?._id || u;
                const idStr = id != null ? String(id) : '';
                return (
                  <option key={idStr} value={idStr}>{u?.name}</option>
                );
              })}
            </select>
          </div>
          <div className="rounded-xl border border-white/10 bg-darkBg/40 p-4">
            <p className="text-sm font-semibold text-textPrimary mb-2">Split among</p>
            <div className="grid grid-cols-2 gap-2">
              {memberOptions.map((m) => {
                const u = m.user;
                const id = u?._id || u;
                const idStr = id != null ? String(id) : '';
                const checked = participants.includes(idStr);
                return (
                  <label key={idStr} className="flex items-center gap-2 text-sm text-textSecondary">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleParticipant(idStr)}
                      className="accent-primary"
                      disabled={saving}
                    />
                    <span className="truncate">{u?.name || 'Member'}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="block text-sm text-textSecondary mb-1">Split type</label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="equal">Equal</option>
                <option value="exact">Exact amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>

            {(splitType === 'exact' || splitType === 'percentage') && (
              <div className="mt-3 space-y-2">
                {participants.map((id) => {
                  const member = memberOptions.find((m) => String(m.user?._id || m.user) === id);
                  const name = member?.user?.name || 'Member';
                  const val = splitValues?.[id] ?? '';
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-textSecondary truncate">{name}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={val}
                        onChange={(e) => setSplitValue(id, e.target.value)}
                        className="w-28 px-3 py-2 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        placeholder={splitType === 'exact' ? '₹' : '%'}
                        disabled={saving}
                      />
                    </div>
                  );
                })}
                <p className="text-xs text-textSecondary">
                  {splitType === 'exact'
                    ? 'Exact amounts should add up to the expense amount.'
                    : 'Percentages should add up to 100.'}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-textSecondary mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCategoryTouched(true);
              }}
              className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {category === 'Custom' && (
            <div>
              <label className="block text-sm text-textSecondary mb-1">Custom category name</label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Subscriptions"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-white/20 text-textSecondary hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-darkBg font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
