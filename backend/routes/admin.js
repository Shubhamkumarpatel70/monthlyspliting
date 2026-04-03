import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import Group from "../models/Group.js";
import Expense from "../models/Expense.js";
import Payment from "../models/Payment.js";
import { protect, isAdmin } from "../middleware/auth.js";

function expenseAdminFilter({
  groupId = "",
  month = "",
  payerId = "",
  category = "",
  search = "",
}) {
  const query = {};
  if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
    query.group = groupId;
  }
  if (month && /^\d{4}-\d{2}$/.test(String(month).trim())) {
    query.month = String(month).trim();
  }
  if (payerId && mongoose.Types.ObjectId.isValid(payerId)) {
    query.payer = payerId;
  }
  if (category && String(category).trim()) {
    query.category = String(category).trim();
  }
  const q = search && String(search).trim();
  if (q) {
    query.description = { $regex: q, $options: "i" };
  }
  return query;
}

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard Statistics
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      totalGroups,
      totalExpenses,
      expenseVolumeAgg,
      recentExpenses,
      totalOTPs,
      activeOTPs,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ emailVerified: true }),
      Group.countDocuments(),
      Expense.countDocuments(),
      Expense.aggregate([
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      Expense.find()
        .populate("payer", "name email")
        .populate("group", "name")
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .select("description amount date month category customCategory group payer"),
      Otp.countDocuments(),
      Otp.countDocuments({ verified: false, expiresAt: { $gt: new Date() } }),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email mobile emailVerified createdAt"),
    ]);

    const totalExpenseAmount = expenseVolumeAgg[0]?.totalAmount || 0;

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
        totalAmount: totalExpenseAmount,
        recent: recentExpenses,
      },
      otps: {
        total: totalOTPs,
        active: activeOTPs,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch statistics" });
  }
});

// User Management
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (status === "verified") query.emailVerified = true;
    if (status === "unverified") query.emailVerified = false;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("+plainPassword +plainMpin")
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
    res.status(500).json({ message: err.message || "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Get user's groups and expenses
    const groups = await Group.find({ "members.user": user._id }).select(
      "name members createdAt",
    );
    const expenses = await Expense.find({ payer: user._id })
      .select("description amount group createdAt")
      .limit(10);

    res.json({ user, groups, expenses });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch user" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, mobile, isActive, emailVerified, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent changing own role or deactivating self
    if (user._id.toString() === req.user._id.toString()) {
      if (role && role !== user.role) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      if (isActive === false) {
        return res.status(400).json({ message: "Cannot deactivate yourself" });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (mobile !== undefined) user.mobile = mobile || null;
    if (isActive !== undefined) user.isActive = isActive;
    if (emailVerified !== undefined) user.emailVerified = emailVerified;
    if (role) user.role = role;

    await user.save();
    const updated = await User.findById(user._id).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    // Soft delete: deactivate instead of deleting
    user.isActive = false;
    await user.save();

    res.json({ message: "User deactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete user" });
  }
});

// OTP Management
router.get("/otps", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      verified = "",
      purpose = "",
      email = "",
      mobile = "",
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (verified === "true") query.verified = true;
    if (verified === "false") query.verified = false;
    if (purpose) query.purpose = purpose;
    if (email) query.email = { $regex: email, $options: "i" };
    if (mobile) query.mobile = { $regex: mobile, $options: "i" };

    const [otps, total] = await Promise.all([
      Otp.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
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
    res.status(500).json({ message: err.message || "Failed to fetch OTPs" });
  }
});

router.delete("/otps/:id", async (req, res) => {
  try {
    await Otp.findByIdAndDelete(req.params.id);
    res.json({ message: "OTP deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete OTP" });
  }
});

router.delete("/otps", async (req, res) => {
  try {
    const { expired = false, verified = false } = req.query;
    const query = {};

    if (expired === "true") {
      query.expiresAt = { $lt: new Date() };
    }
    if (verified === "true") {
      query.verified = true;
    }

    const result = await Otp.deleteMany(query);
    res.json({ message: `Deleted ${result.deletedCount} OTPs` });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete OTPs" });
  }
});

// Group Management
router.get("/groups", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const [groups, total] = await Promise.all([
      Group.find(query)
        .populate("members.user", "name email mobile")
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
    res.status(500).json({ message: err.message || "Failed to fetch groups" });
  }
});

router.delete("/groups/:id", async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    // Also delete associated expenses
    await Expense.deleteMany({ group: req.params.id });
    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete group" });
  }
});

// Expense Management — all expenses system-wide with filters
router.get("/expenses", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      groupId = "",
      month = "",
      payerId = "",
      category = "",
      search = "",
    } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const query = expenseAdminFilter({
      groupId,
      month,
      payerId,
      category,
      search,
    });

    const [expenses, total, sumAgg] = await Promise.all([
      Expense.find(query)
        .populate("payer", "name email mobile")
        .populate("group", "name")
        .populate("addedBy", "name email")
        .populate("editHistory.editedBy", "name email")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Expense.countDocuments(query),
      Expense.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
    ]);

    const totalAmount = sumAgg[0]?.totalAmount || 0;

    res.json({
      expenses,
      summary: {
        count: total,
        totalAmount,
        filtersMatchCount: total,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch expenses" });
  }
});

// Transaction/Payment Management
router.get("/transactions", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status = "",
      groupId = "",
      userId = "",
      month = "",
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;
    if (groupId) query.group = groupId;
    if (userId) {
      query.$or = [{ from: userId }, { to: userId }];
    }
    if (month) query.month = month;

    const [transactions, total, statusCounts] = await Promise.all([
      Payment.find(query)
        .populate("from", "name email mobile")
        .populate("to", "name email mobile")
        .populate("group", "name")
        .populate("confirmedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(query),
      Payment.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    // Calculate stats
    const stats = {
      pending: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };
    statusCounts.forEach((s) => {
      if (stats[s._id]) {
        stats[s._id] = { count: s.count, amount: s.totalAmount };
      }
    });

    res.json({
      transactions,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch transactions" });
  }
});

// Get all groups for filter dropdown
router.get("/groups-list", async (req, res) => {
  try {
    const groups = await Group.find().select("name").sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch groups" });
  }
});

// Get all users for filter dropdown
router.get("/users-list", async (req, res) => {
  try {
    const users = await User.find().select("name email").sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch users" });
  }
});

export default router;
