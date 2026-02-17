import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  month: { type: String, required: true },
  status: { type: String, enum: ['pending', 'settled', 'archived'], default: 'pending' },
  transactions: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
  }],
  settledAt: Date,
}, { timestamps: true });

settlementSchema.index({ group: 1, month: 1 }, { unique: true });

export default mongoose.model('Settlement', settlementSchema);
