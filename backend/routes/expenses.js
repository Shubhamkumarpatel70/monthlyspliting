import express from 'express';
import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';
import Advance from '../models/Advance.js';
import Settlement from '../models/Settlement.js';
import { protect, groupMember } from '../middleware/auth.js';
import { computeMonthlyBalances, getMonthFromDate } from '../utils/balanceCalculator.js';
import { generateMinimalTransactions } from '../utils/settlementGenerator.js';

const router = express.Router();

router.use(protect);

function extractMonth(bodyDate) {
  if (!bodyDate) return null;
  const d = new Date(bodyDate);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toIdString(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x._id) return String(x._id);
  return String(x);
}

function normalizeSplitPayload({ amount, memberIds, participants, splitType, splitValues }) {
  const amt = Number(amount);
  const allowedTypes = ["equal", "exact", "percentage"];
  const type = allowedTypes.includes(splitType) ? splitType : "equal";

  const partsRaw = Array.isArray(participants) ? participants : [];
  const parts = partsRaw
    .map(toIdString)
    .filter(Boolean);
  const uniqueParts = [...new Set(parts)];

  const finalParticipants = uniqueParts.length ? uniqueParts : [...memberIds];
  const allAreMembers = finalParticipants.every((id) => memberIds.includes(id));
  if (!allAreMembers) {
    return { ok: false, message: "Participants must be group members" };
  }

  const values = splitValues && typeof splitValues === "object" ? splitValues : null;

  if (type === "equal") {
    return { ok: true, participants: finalParticipants, splitType: "equal", splitValues: undefined };
  }

  if (!values) return { ok: false, message: "splitValues required for exact/percentage splits" };

  // Coerce values map to numbers for participants only
  const cleaned = {};
  finalParticipants.forEach((id) => {
    const v = values[id];
    if (v != null && v !== "") cleaned[id] = Number(v);
  });

  if (type === "exact") {
    const sum = Object.values(cleaned).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
    if (Math.abs(sum - amt) > 0.5) {
      return { ok: false, message: "Exact split must sum to the expense amount" };
    }
    return { ok: true, participants: finalParticipants, splitType: "exact", splitValues: cleaned };
  }

  // percentage
  const sumPct = Object.values(cleaned).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  if (Math.abs(sumPct - 100) > 0.5) {
    return { ok: false, message: "Percentage split must sum to 100" };
  }
  return { ok: true, participants: finalParticipants, splitType: "percentage", splitValues: cleaned };
}

router.post('/:groupId', groupMember, async (req, res) => {
  try {
    const { description, amount, date, category, customCategory, aiGenerated, aiRawInput, participants, splitType, splitValues } = req.body;
    const payerId = req.body.payer || req.user._id;
    if (!description?.trim() || amount == null || amount < 0.01) {
      return res.status(400).json({ message: 'Description and positive amount required' });
    }
    const dateObj = date ? new Date(date) : new Date();
    const month = extractMonth(date) || getMonthFromDate(dateObj);
    const memberIds = req.group.members.map(m => (m.user?._id || m.user).toString());
    const payerStr = payerId?.toString?.() || String(payerId);
    if (!memberIds.includes(payerStr)) return res.status(400).json({ message: 'Payer must be a group member' });
    const split = normalizeSplitPayload({ amount, memberIds, participants, splitType, splitValues });
    if (!split.ok) return res.status(400).json({ message: split.message });
    const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Misc';
    const expense = await Expense.create({
      group: req.params.groupId,
      description: description.trim(),
      amount: Number(amount),
      payer: payerStr,
      date: dateObj,
      month,
      category: cat,
      customCategory: cat === 'Custom' ? (customCategory || '').trim() : undefined,
      participants: split.participants,
      splitType: split.splitType,
      splitValues: split.splitValues,
      aiGenerated: Boolean(aiGenerated),
      aiRawInput: typeof aiRawInput === 'string' ? aiRawInput.slice(0, 2000) : '',
      addedBy: req.user._id,
    });
    const populated = await Expense.findById(expense._id)
      .populate('payer', 'name email')
      .populate('addedBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to add expense' });
  }
});

router.get('/:groupId/expenses', groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { group: req.params.groupId };
    if (month) filter.month = month;
    const expenses = await Expense.find(filter)
      .populate('payer', 'name email mobile')
      .populate('addedBy', 'name')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch expenses' });
  }
});

router.get('/:groupId/months', groupMember, async (req, res) => {
  try {
    const months = await Expense.distinct('month', { group: req.params.groupId });
    res.json(months.sort().reverse());
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch months' });
  }
});

router.get('/:groupId/balances', groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) required' });
    const [expenses, advances] = await Promise.all([
      Expense.find({ group: req.params.groupId, month }).populate('payer', 'name'),
      Advance.find({ group: req.params.groupId, month }),
    ]);
    const memberIds = req.group.members.map(m => m.user._id || m.user);
    const result = computeMonthlyBalances(expenses, memberIds, advances);
    const userMap = new Map();
    req.group.members.forEach(m => {
      const u = m.user;
      const id = u._id?.toString() ?? u?.toString();
      if (id) userMap.set(id, { name: u.name, email: u.email });
    });

    // Attach display name directly on each balance object so frontend
    // can access fields like "paid", "finalNet" etc. without nesting.
    const balancesWithNames = Object.fromEntries(
      Object.entries(result.balances).map(([id, b]) => [
        id,
        {
          ...b,
          name: userMap.get(id)?.name ?? id,
        },
      ])
    );

    res.json({
      ...result,
      balances: balancesWithNames,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to compute balances' });
  }
});

router.get('/:groupId/settlement', groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) required' });
    let settlement = await Settlement.findOne({ group: req.params.groupId, month })
      .populate('transactions.from', 'name')
      .populate('transactions.to', 'name');
    const [expenses, advances] = await Promise.all([
      Expense.find({ group: req.params.groupId, month }).populate('payer', 'name'),
      Advance.find({ group: req.params.groupId, month }),
    ]);
    const memberIds = req.group.members.map(m => m.user._id || m.user);
    const result = computeMonthlyBalances(expenses, memberIds, advances);
    // For settlement, use ORIGINAL net (paid - original share),
    // so advances don't change who needs to pay whom.
    const balances = Object.fromEntries(
      Object.entries(result.balances || {}).map(([id, b]) => [id, b.originalNet ?? 0]),
    );
    const userMap = new Map();
    req.group.members.forEach(m => {
      const u = m.user;
      const id = u._id?.toString() ?? u?.toString();
      if (id) userMap.set(id, { name: u.name });
    });
    const transactions = generateMinimalTransactions(balances, userMap);
    if (!settlement) {
      settlement = await Settlement.create({
        group: req.params.groupId,
        month,
        transactions: transactions.map(t => ({ from: t.from, to: t.to, amount: t.amount })),
      });
    } else {
      settlement.transactions = transactions.map(t => ({ from: t.from, to: t.to, amount: t.amount }));
      await settlement.save();
    }
    const populated = await Settlement.findById(settlement._id)
      .populate('transactions.from', 'name')
      .populate('transactions.to', 'name');
    res.json({
      ...populated.toObject(),
      transactionsWithNames: transactions,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get settlement' });
  }
});

router.put('/:groupId/settlement/status', groupMember, async (req, res) => {
  try {
    const { month, status } = req.body;
    if (!month) return res.status(400).json({ message: 'Month required' });
    let settlement = await Settlement.findOne({ group: req.params.groupId, month });
    if (!settlement) {
      settlement = await Settlement.create({ group: req.params.groupId, month, transactions: [] });
    }
    if (['pending', 'settled', 'archived'].includes(status)) {
      settlement.status = status;
      if (status === 'settled') settlement.settledAt = new Date();
    }
    await settlement.save();
    const populated = await Settlement.findById(settlement._id)
      .populate('transactions.from', 'name')
      .populate('transactions.to', 'name');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update settlement' });
  }
});

router.put('/:groupId/expenses/:expenseId', groupMember, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      group: req.params.groupId,
    }).populate('payer', 'name');
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    const { description, amount, date, payer, category, customCategory, aiGenerated, aiRawInput, participants, splitType, splitValues } = req.body;
    if (description?.trim()) expense.description = description.trim();
    if (amount != null && amount >= 0.01) expense.amount = Number(amount);
    if (date) {
      expense.date = new Date(date);
      expense.month = extractMonth(date) || getMonthFromDate(expense.date);
    }
    const memberIds = req.group.members.map(m => (m.user?._id || m.user).toString());
    if (payer && memberIds.includes(payer.toString())) {
      expense.payer = payer;
    }
    if (category && EXPENSE_CATEGORIES.includes(category)) {
      expense.category = category;
      expense.customCategory = category === 'Custom' ? (customCategory || '').trim() : undefined;
    }
    if (participants || splitType || splitValues) {
      const memberIds = req.group.members.map(m => (m.user?._id || m.user).toString());
      const split = normalizeSplitPayload({
        amount: expense.amount,
        memberIds,
        participants,
        splitType,
        splitValues,
      });
      if (!split.ok) return res.status(400).json({ message: split.message });
      expense.participants = split.participants;
      expense.splitType = split.splitType;
      expense.splitValues = split.splitValues;
    }
    if (typeof aiGenerated === 'boolean') expense.aiGenerated = aiGenerated;
    if (typeof aiRawInput === 'string') expense.aiRawInput = aiRawInput.slice(0, 2000);
    await expense.save();
    const populated = await Expense.findById(expense._id)
      .populate('payer', 'name email')
      .populate('addedBy', 'name');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update expense' });
  }
});

router.delete('/:groupId/expenses/:expenseId', groupMember, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.expenseId,
      group: req.params.groupId,
    });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete expense' });
  }
});

// Export monthly report as CSV
router.get('/:groupId/export', groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) required' });
    const [expenses, advances] = await Promise.all([
      Expense.find({ group: req.params.groupId, month }).populate('payer', 'name').sort({ date: 1 }),
      Advance.find({ group: req.params.groupId, month }),
    ]);
    const memberIds = req.group.members.map(m => m.user._id || m.user);
    const result = computeMonthlyBalances(expenses, memberIds, advances);
    const userMap = new Map();
    req.group.members.forEach(m => {
      const u = m.user;
      const id = u._id?.toString() ?? u?.toString();
      if (id) userMap.set(id, u.name || id);
    });
    const rows = [];
    rows.push('Monthly Report - ' + month);
    rows.push('');
    rows.push('EXPENSES');
    rows.push('Date,Description,Category,Paid By,Amount');
    expenses.forEach(e => {
      const d = new Date(e.date).toLocaleDateString();
      const cat = e.category === 'Custom' && e.customCategory ? e.customCategory : e.category;
      const desc = (e.description || '').replace(/"/g, '""');
      rows.push(d + ',"' + desc + '",' + cat + ',' + (e.payer?.name || 'Unknown') + ',' + e.amount.toFixed(2));
    });
    rows.push('');
    rows.push('ADVANCES');
    rows.push('Payer,Amount,Description');
    advances.forEach(a => {
      const name = userMap.get(a.user?.toString()) || 'Unknown';
      const desc = (a.description || '').replace(/"/g, '""');
      rows.push(name + ',' + a.amount.toFixed(2) + ',"' + desc + '"');
    });
    rows.push('');
    rows.push('SUMMARY');
    rows.push('Total Expenses,' + result.totalExpense.toFixed(2));
    rows.push('Total Advances,' + result.totalAdvance.toFixed(2));
    rows.push('Total Pool,' + (result.totalExpense + result.totalAdvance).toFixed(2));
    rows.push('Per Person Share,' + result.finalShare.toFixed(2));
    rows.push('');
    rows.push('BALANCES');
    rows.push('Member,Paid,Share,Final Net');
    Object.entries(result.balances).forEach(([id, bal]) => {
      const name = userMap.get(id) || id;
      const paid = result.paidByUser[id] || 0;
      const finalNet = bal.finalNet ?? 0;
      rows.push(
        name +
          ',' +
          paid.toFixed(2) +
          ',' +
          result.finalShare.toFixed(2) +
          ',' +
          finalNet.toFixed(2)
      );
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report-' + month + '.csv"');
    res.send(rows.join('\r\n'));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export report' });
  }
});

export default router;
