import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    month: { type: String, required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "cash", "bank_transfer", "other"],
      default: "upi",
    },
    upiId: { type: String }, // Receiver's UPI ID
    transactionId: { type: String }, // UPI transaction reference
    notes: { type: String },
    paidAt: Date,
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Receiver confirms
    confirmedAt: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ group: 1, month: 1, from: 1, to: 1 });

export default mongoose.model("Payment", paymentSchema);
