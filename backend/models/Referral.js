import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referred_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  payment_amount: { type: Number, default: 0 },
  referral_points: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'expired'], 
    default: 'pending',
    index: true 
  },
  created_at: { type: Date, default: Date.now },
  activated_at: Date
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Compound index for referrer queries
referralSchema.index({ referrer_id: 1, status: 1 });
referralSchema.index({ created_at: -1 });

export default mongoose.model('Referral', referralSchema);
