import mongoose from 'mongoose';

const quizTicketSchema = new mongoose.Schema({
  seller_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyer_name: String,
  buyer_contact: String,
  ticket_price: { type: Number, default: 100 },
  points_earned: { type: Number, default: 0 },
  sold_at: { type: Date, default: Date.now }
}, { 
  timestamps: { createdAt: 'sold_at', updatedAt: false }
});

// Indexes
quizTicketSchema.index({ seller_id: 1, sold_at: -1 });
quizTicketSchema.index({ sold_at: -1 });

export default mongoose.model('QuizTicket', quizTicketSchema);
