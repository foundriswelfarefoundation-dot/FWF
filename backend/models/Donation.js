import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  donation_id:    { type: String, unique: true, sparse: true },          // DON-000001
  member_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null, index: true },
  amount:         { type: Number, required: true },
  points_earned:  { type: Number, default: 0 },

  // Donor details
  donor_name:     { type: String, default: 'Anonymous' },
  donor_email:    { type: String, default: null },
  donor_mobile:   { type: String, default: null },
  donor_pan:      { type: String, default: null },      // For 80G tax receipt
  donor_address:  { type: String, default: null },      // For KYC (high-value donors)

  // Payment info
  source:         { type: String, default: 'razorpay' }, // razorpay | cash | bank_transfer | upi
  payment_id:     { type: String, default: null },       // Razorpay payment ID
  order_id:       { type: String, default: null },       // Razorpay order ID

  // KYC / Compliance
  kyc_required:   { type: Boolean, default: false },    // true when amount >= 50000
  otp_verified:   { type: Boolean, default: false },    // OTP was verified pre-payment
  kyc_status: {
    type: String,
    enum: ['not_required', 'otp_verified', 'pending_docs', 'doc_verified'],
    default: 'not_required'
  },

  receipt_issued: { type: Boolean, default: false },
  admin_notes:    { type: String, default: null },
  created_at:     { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

donationSchema.index({ member_id: 1, created_at: -1 });
donationSchema.index({ created_at: -1 });
donationSchema.index({ kyc_status: 1 });

export default mongoose.model('Donation', donationSchema);
