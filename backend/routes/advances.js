import express from "express";
import Advance from "../models/Advance.js";
import { protect, groupMember } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Create advance
router.post("/:groupId/advances", groupMember, async (req, res) => {
  try {
    const { amount, month, description, user: payerUserId } = req.body;
    if (amount == null || amount < 0.01) {
      return res.status(400).json({ message: "Positive amount required" });
    }
    if (!month) {
      return res.status(400).json({ message: "Month (YYYY-MM) required" });
    }
    const payer = payerUserId || req.user._id;
    const memberIds = req.group.members.map((m) =>
      (m.user?._id || m.user).toString(),
    );
    if (!memberIds.includes(payer.toString())) {
      return res.status(400).json({ message: "Payer must be a group member" });
    }
    const advance = await Advance.create({
      group: req.params.groupId,
      user: payer,
      amount: Number(amount),
      month,
      description: (description || "").trim(),
      addedBy: req.user._id,
    });
    const populated = await Advance.findById(advance._id)
      .populate("user", "name email")
      .populate("addedBy", "name");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to add advance" });
  }
});

// List advances for a group/month
router.get("/:groupId/advances", groupMember, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { group: req.params.groupId };
    if (month) filter.month = month;
    const advances = await Advance.find(filter)
      .populate("user", "name email")
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });
    res.json(advances);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch advances" });
  }
});

// Update advance
router.put("/:groupId/advances/:advanceId", groupMember, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (amount != null && amount < 0.01) {
      return res.status(400).json({ message: "Positive amount required" });
    }
    const updateData = {};
    if (amount != null) updateData.amount = Number(amount);
    if (description !== undefined) updateData.description = description.trim();

    const advance = await Advance.findOneAndUpdate(
      { _id: req.params.advanceId, group: req.params.groupId },
      updateData,
      { new: true },
    )
      .populate("user", "name email")
      .populate("addedBy", "name");

    if (!advance) return res.status(404).json({ message: "Advance not found" });
    res.json(advance);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to update advance" });
  }
});

// Delete advance
router.delete(
  "/:groupId/advances/:advanceId",
  groupMember,
  async (req, res) => {
    try {
      const advance = await Advance.findOneAndDelete({
        _id: req.params.advanceId,
        group: req.params.groupId,
      });
      if (!advance)
        return res.status(404).json({ message: "Advance not found" });
      res.json({ message: "Advance deleted" });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Failed to delete advance" });
    }
  },
);

export default router;
