import mongoose from 'mongoose';

const csrPartnerSchema = new mongoose.Schema({
  partner_id:        { type: String, required: true, unique: true },
  company_name:      { type: String, required: true },
  contact_person:    { type: String },
  email:             { type: String },
  phone:             { type: String },
  industry:          { type: String },
  partnership_type:  { type: String, default: 'funding' },
  commitment_amount: { type: Number, default: 0 },
  paid_amount:       { type: Number, default: 0 },
  status:            { type: String, enum: ['lead', 'active', 'inactive', 'closed'], default: 'lead' },
  notes:             { type: String },
  created_at:        { type: Date, default: Date.now },
  updated_at:        { type: Date, default: Date.now }
});

csrPartnerSchema.index({ status: 1 });

export default mongoose.models.CsrPartner || mongoose.model('CsrPartner', csrPartnerSchema);
