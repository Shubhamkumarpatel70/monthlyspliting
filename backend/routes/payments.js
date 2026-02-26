import express from "express";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Settlement from "../models/Settlement.js";
import { protect, groupMember } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Get all payments for a group/month
router.get("/:groupId/payments", groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { group: req.params.groupId };
    if (month) filter.month = month;

    const payments = await Payment.find(filter)
      .populate("from", "name email mobile")
      .populate("to", "name email mobile")
      .populate("confirmedBy", "name")
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch payments" });
  }
});

// Get receiver's UPI ID
router.get("/:groupId/payments/upi/:userId", groupMember, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("name upiId");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ name: user.name, upiId: user.upiId || null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch UPI ID" });
  }
});

// Create a payment record (when user initiates payment)
router.post("/:groupId/payments", groupMember, async (req, res) => {
  try {
    const { month, toUserId, amount, paymentMethod, transactionId, notes } =
      req.body;

    if (!month || !toUserId || !amount) {
      return res
        .status(400)
        .json({ message: "Month, recipient, and amount required" });
    }

    // Check if there's already a pending payment for this
    const existingPending = await Payment.findOne({
      group: req.params.groupId,
      month,
      from: req.user._id,
      to: toUserId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        message: "Payment already pending confirmation",
      });
    }

    // Allow new payments - they can make multiple payments if needed
    // (e.g., partial payment followed by another payment for remaining amount)
    const payment = await Payment.create({
      group: req.params.groupId,
      month,
      from: req.user._id,
      to: toUserId,
      amount: Number(amount),
      paymentMethod: paymentMethod || "upi",
      transactionId,
      notes,
      status: "pending",
      paidAt: new Date(),
    });

    const populated = await Payment.findById(payment._id)
      .populate("from", "name email mobile")
      .populate("to", "name email mobile");

    res.status(201).json(populated);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to create payment" });
  }
});

// Confirm payment (receiver confirms they received the money)
router.put(
  "/:groupId/payments/:paymentId/confirm",
  groupMember,
  async (req, res) => {
    try {
      const payment = await Payment.findOne({
        _id: req.params.paymentId,
        group: req.params.groupId,
      });

      if (!payment)
        return res.status(404).json({ message: "Payment not found" });

      // Only the receiver can confirm
      if (payment.to.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Only the recipient can confirm payment" });
      }

      if (payment.status === "completed") {
        return res.status(400).json({ message: "Payment already confirmed" });
      }

      payment.status = "completed";
      payment.confirmedBy = req.user._id;
      payment.confirmedAt = new Date();
      await payment.save();

      // Check if all transactions for this month are fully paid
      const settlement = await Settlement.findOne({
        group: req.params.groupId,
        month: payment.month,
      });

      if (settlement && settlement.status !== "settled") {
        const allPayments = await Payment.find({
          group: req.params.groupId,
          month: payment.month,
          status: "completed",
        });

        // Check if all settlement transactions are fully paid (including partial payments)
        const allPaid = settlement.transactions.every((t) => {
          // Sum all completed payments from this sender to this receiver
          const totalPaid = allPayments
            .filter(
              (p) =>
                p.from.toString() === t.from.toString() &&
                p.to.toString() === t.to.toString(),
            )
            .reduce((sum, p) => sum + p.amount, 0);

          // Check if total paid covers the transaction amount (with small tolerance)
          return totalPaid >= t.amount - 0.01;
        });

        if (allPaid && settlement.transactions.length > 0) {
          settlement.status = "settled";
          settlement.settledAt = new Date();
          await settlement.save();
        }
      }

      const populated = await Payment.findById(payment._id)
        .populate("from", "name email mobile")
        .populate("to", "name email mobile")
        .populate("confirmedBy", "name");

      res.json(populated);
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Failed to confirm payment" });
    }
  },
);

// Reject/Cancel payment
router.put(
  "/:groupId/payments/:paymentId/reject",
  groupMember,
  async (req, res) => {
    try {
      const payment = await Payment.findOne({
        _id: req.params.paymentId,
        group: req.params.groupId,
      });

      if (!payment)
        return res.status(404).json({ message: "Payment not found" });

      // Receiver can reject, sender can cancel
      const isReceiver = payment.to.toString() === req.user._id.toString();
      const isSender = payment.from.toString() === req.user._id.toString();

      if (!isReceiver && !isSender) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (payment.status === "completed") {
        return res
          .status(400)
          .json({ message: "Cannot reject completed payment" });
      }

      payment.status = isSender ? "cancelled" : "failed";
      payment.notes = req.body.reason || payment.notes;
      await payment.save();

      const populated = await Payment.findById(payment._id)
        .populate("from", "name email mobile")
        .populate("to", "name email mobile");

      res.json(populated);
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Failed to reject payment" });
    }
  },
);

// Update user's UPI ID
router.put("/upi", protect, async (req, res) => {
  try {
    const { upiId } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      upiId: upiId?.trim() || null,
    });
    res.json({ message: "UPI ID updated", upiId: upiId?.trim() || null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update UPI ID" });
  }
});

// Get current user's UPI ID
router.get("/upi", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("upiId");
    res.json({ upiId: user?.upiId || null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch UPI ID" });
  }
});

export default router;
