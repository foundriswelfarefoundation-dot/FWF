import mongoose from 'mongoose';

const referralClickSchema = new mongoose.Schema({
  referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral_code: { type: String, required: true, index: true },
  link_type: { type: String, enum: ['quiz', 'join', 'general'], default: 'general' },
  quiz_id: { type: String }, // if quiz-specific referral
  ip_address: { type: String },
  user_agent: { type: String },
  converted: { type: Boolean, default: false }, // did they sign up / purchase
  converted_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  conversion_type: { type: String, enum: ['signup', 'quiz_enrollment', 'donation', null], default: null },
  conversion_amount: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

referralClickSchema.index({ referrer_id: 1, created_at: -1 });
referralClickSchema.index({ referral_code: 1, created_at: -1 });
referralClickSchema.index({ converted: 1 });

export default mongoose.model('ReferralClick', referralClickSchema);
