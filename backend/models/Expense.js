import mongoose from "mongoose";

const EXPENSE_CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Bills",
  "Shopping",
  "Entertainment",
  "Groceries",
  "Health",
  "Others",
  "Utilities",
  "Misc",
  "Custom",
];

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true },
    month: { type: String, required: true }, // YYYY-MM for indexing and filtering
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Others" },
    customCategory: { type: String, trim: true },
    // Set when the user used AI parse and/or AI category suggestion for this row
    aiGenerated: { type: Boolean, default: false },
    // Original natural-language line (optional); stored in MongoDB with the expense
    aiRawInput: { type: String, default: "" },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

expenseSchema.index({ group: 1, month: 1 });
expenseSchema.index({ group: 1, date: -1 });

export const getCategoryLabel = (exp) =>
  exp.category === "Custom" ? exp.customCategory || "Custom" : exp.category;

export default mongoose.model("Expense", expenseSchema);
export { EXPENSE_CATEGORIES };
