import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  month: { type: String, required: true }, // YYYY-MM
  description: { type: String, trim: true, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

advanceSchema.index({ group: 1, month: 1 });

export default mongoose.model('Advance', advanceSchema);
