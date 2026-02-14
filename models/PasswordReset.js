import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
  memberId: { type: String, required: true },
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
}, { timestamps: true });

// Auto-delete expired OTPs after 15 minutes
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordReset', passwordResetSchema);
