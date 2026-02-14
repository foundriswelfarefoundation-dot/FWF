import mongoose from 'mongoose';

const membershipFeeSchema = new mongoose.Schema({
  txn_id:          { type: String, required: true, unique: true },
  member_id:       { type: String, required: true },
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  member_name:     { type: String },
  amount:          { type: Number, required: true },
  fee_type:        { type: String, enum: ['joining', 'renewal', 'other'], default: 'joining' },
  payment_mode:    { type: String, default: 'online' },
  payment_ref:     { type: String },
  status:          { type: String, enum: ['pending', 'verified', 'rejected', 'refunded'], default: 'pending' },
  verified_by:     { type: String },
  verified_at:     { type: Date },
  notes:           { type: String },
  created_at:      { type: Date, default: Date.now },
  updated_at:      { type: Date, default: Date.now }
});

membershipFeeSchema.index({ member_id: 1 });
membershipFeeSchema.index({ status: 1 });

export default mongoose.models.MembershipFee || mongoose.model('MembershipFee', membershipFeeSchema);
