import express from 'express';
import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';
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

router.post('/:groupId', groupMember, async (req, res) => {
  try {
    const { description, amount, date, category, customCategory } = req.body;
    const payerId = req.body.payer || req.user._id;
    if (!description?.trim() || amount == null || amount < 0.01) {
      return res.status(400).json({ message: 'Description and positive amount required' });
    }
    const dateObj = date ? new Date(date) : new Date();
    const month = extractMonth(date) || getMonthFromDate(dateObj);
    const memberIds = req.group.members.map(m => (m.user?._id || m.user).toString());
    const payerStr = payerId?.toString?.() || String(payerId);
    if (!memberIds.includes(payerStr)) return res.status(400).json({ message: 'Payer must be a group member' });
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
    const expenses = await Expense.find({ group: req.params.groupId, month })
      .populate('payer', 'name');
    const memberIds = req.group.members.map(m => m.user._id || m.user);
    const result = computeMonthlyBalances(expenses, memberIds);
    const userMap = new Map();
    req.group.members.forEach(m => {
      const u = m.user;
      const id = u._id?.toString() ?? u?.toString();
      if (id) userMap.set(id, { name: u.name, email: u.email });
    });
    const withNames = {
      ...result,
      balances: Object.fromEntries(
        Object.entries(result.balances).map(([id, b]) => [id, { balance: b, name: userMap.get(id)?.name ?? id }])
      ),
    };
    res.json(withNames);
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
    const expenses = await Expense.find({ group: req.params.groupId, month }).populate('payer', 'name');
    const memberIds = req.group.members.map(m => m.user._id || m.user);
    const { balances } = computeMonthlyBalances(expenses, memberIds);
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
    const { description, amount, date, payer, category, customCategory } = req.body;
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

export default router;
