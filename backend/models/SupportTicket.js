import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  ticket_id:   { type: String, required: true, unique: true },
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user_name:   { type: String },
  user_email:  { type: String },
  subject:     { type: String, required: true },
  message:     { type: String, required: true },
  category:    { type: String, default: 'general' },
  status:      { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
  admin_reply: { type: String },
  replied_at:  { type: Date },
  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now }
});

supportTicketSchema.index({ user_id: 1 });
supportTicketSchema.index({ status: 1 });

export default mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
