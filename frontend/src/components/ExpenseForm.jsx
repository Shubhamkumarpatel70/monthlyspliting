import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

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

  useEffect(() => {
    if (!payerId && group?.members?.length) {
      const first = group.members[0].user?._id || group.members[0].user;
      setPayerId(first != null ? String(first) : '');
    }
  }, [group, payerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || isNaN(amt) || amt < 0.01) {
      setError('Description and a positive amount are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: amt,
        date: new Date(date).toISOString(),
        payer: payerId ? String(payerId) : undefined,
        category: category === 'Custom' ? 'Custom' : category,
        customCategory: category === 'Custom' ? customCategory : undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const memberOptions = group?.members ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 overflow-y-auto" onClick={onCancel}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-xl mt-auto sm:mt-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-textPrimary mb-4">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm text-textSecondary mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
