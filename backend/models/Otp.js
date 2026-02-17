import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true },
  mobile: { type: String, trim: true },
  code: { type: String, required: true },
  purpose: { type: String, enum: ['signup', 'login', 'reset'], default: 'signup' },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

// Ensure either email or mobile is provided
otpSchema.pre('validate', function (next) {
  if (!this.email && !this.mobile) {
    return next(new Error('Either email or mobile must be provided'));
  }
  next();
});

// Index for quick lookup
otpSchema.index({ email: 1, purpose: 1, verified: 1 });
otpSchema.index({ mobile: 1, purpose: 1, verified: 1 });

export default mongoose.model('Otp', otpSchema);
