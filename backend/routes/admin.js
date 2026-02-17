import express from 'express';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard Statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      totalGroups,
      totalExpenses,
      totalOTPs,
      activeOTPs,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ emailVerified: true }),
      Group.countDocuments(),
      Expense.countDocuments(),
      Otp.countDocuments(),
      Otp.countDocuments({ verified: false, expiresAt: { $gt: new Date() } }),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email mobile emailVerified createdAt'),
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        recent: recentUsers,
      },
      groups: {
        total: totalGroups,
      },
      expenses: {
        total: totalExpenses,
      },
      otps: {
        total: totalOTPs,
        active: activeOTPs,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch statistics' });
  }
});

// User Management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.emailVerified = true;
    if (status === 'unverified') query.emailVerified = false;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch users' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Get user's groups and expenses
    const groups = await Group.find({ 'members.user': user._id }).select('name members createdAt');
    const expenses = await Expense.find({ payer: user._id }).select('description amount group createdAt').limit(10);
    
    res.json({ user, groups, expenses });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, mobile, isActive, emailVerified, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent changing own role or deactivating self
    if (user._id.toString() === req.user._id.toString()) {
      if (role && role !== user.role) {
        return res.status(400).json({ message: 'Cannot change your own role' });
      }
      if (isActive === false) {
        return res.status(400).json({ message: 'Cannot deactivate yourself' });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (mobile !== undefined) user.mobile = mobile || null;
    if (isActive !== undefined) user.isActive = isActive;
    if (emailVerified !== undefined) user.emailVerified = emailVerified;
    if (role) user.role = role;

    await user.save();
    const updated = await User.findById(user._id).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Soft delete: deactivate instead of deleting
    user.isActive = false;
    await user.save();
    
    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete user' });
  }
});

// OTP Management
router.get('/otps', async (req, res) => {
  try {
    const { page = 1, limit = 50, verified = '', purpose = '', email = '', mobile = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (verified === 'true') query.verified = true;
    if (verified === 'false') query.verified = false;
    if (purpose) query.purpose = purpose;
    if (email) query.email = { $regex: email, $options: 'i' };
    if (mobile) query.mobile = { $regex: mobile, $options: 'i' };

    const [otps, total] = await Promise.all([
      Otp.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Otp.countDocuments(query),
    ]);

    res.json({
      otps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch OTPs' });
  }
});

router.delete('/otps/:id', async (req, res) => {
  try {
    await Otp.findByIdAndDelete(req.params.id);
    res.json({ message: 'OTP deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete OTP' });
  }
});

router.delete('/otps', async (req, res) => {
  try {
    const { expired = false, verified = false } = req.query;
    const query = {};
    
    if (expired === 'true') {
      query.expiresAt = { $lt: new Date() };
    }
    if (verified === 'true') {
      query.verified = true;
    }

    const result = await Otp.deleteMany(query);
    res.json({ message: `Deleted ${result.deletedCount} OTPs` });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete OTPs' });
  }
});

// Group Management
router.get('/groups', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const [groups, total] = await Promise.all([
      Group.find(query)
        .populate('members.user', 'name email mobile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Group.countDocuments(query),
    ]);

    res.json({
      groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch groups' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    // Also delete associated expenses
    await Expense.deleteMany({ group: req.params.id });
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete group' });
  }
});

// Expense Management
router.get('/expenses', async (req, res) => {
  try {
    const { page = 1, limit = 50, groupId = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (groupId) query.group = groupId;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('payer', 'name email')
        .populate('group', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Expense.countDocuments(query),
    ]);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch expenses' });
  }
});

export default router;
