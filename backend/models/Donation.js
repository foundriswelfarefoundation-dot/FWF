import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null, index: true },
  amount: { type: Number, required: true },
  points_earned: { type: Number, default: 0 },
  donor_name: String,
  donor_contact: String,
  source: { type: String, default: 'direct' },
  created_at: { type: Date, default: Date.now }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Indexes for queries
donationSchema.index({ member_id: 1, created_at: -1 });
donationSchema.index({ created_at: -1 });

export default mongoose.model('Donation', donationSchema);
