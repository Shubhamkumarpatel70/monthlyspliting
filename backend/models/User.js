import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: { type: String, trim: true, sparse: true }, // optional, unique when set
    password: { type: String, required: true, minlength: 6, select: false },
    plainPassword: { type: String, select: false }, // plain text for admin view
    mpin: { type: String, select: false }, // hashed 4-digit MPIN
    plainMpin: { type: String, select: false }, // plain text for admin view
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    upiId: { type: String, trim: true }, // UPI ID for receiving payments
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    // Store plain password before hashing (for admin view)
    if (!this.password.startsWith("$2")) {
      this.plainPassword = this.password;
    }
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified("mpin") && this.mpin) {
    if (!this.mpin.startsWith("$2")) {
      this.plainMpin = this.mpin;
      this.mpin = await bcrypt.hash(this.mpin, 12);
    }
  }
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.compareMpin = function (candidate) {
  if (!this.mpin) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.mpin);
};

export default mongoose.model("User", userSchema);
