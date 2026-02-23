import mongoose from 'mongoose';

const donationOtpSchema = new mongoose.Schema({
  email:           { type: String, required: true, index: true },
  mobile:          { type: String, required: true },
  name:            { type: String, required: true },
  amount:          { type: Number, required: true },
  otp:             { type: String, required: true },
  verified:        { type: Boolean, default: false },
  verified_token:  { type: String, default: null },  // Returned after OTP success
  attempts:        { type: Number, default: 0 },
  expires_at:      { type: Date, required: true },
  created_at:      { type: Date, default: Date.now }
});

// Auto-delete expired OTP documents
donationOtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('DonationOtp', donationOtpSchema);
