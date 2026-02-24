import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema({
  quiz_id: { type: String, unique: true, required: true }, // e.g. "M2506", "H2506", "Y2506"
  title: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['monthly', 'half_yearly', 'yearly'],
    required: true
  },
  game_type: {
    type: String,
    enum: ['mcq', 'true_false', 'picture', 'speed', 'puzzle', 'general'],
    default: 'mcq'
  },
  entry_fee: { type: Number, required: true }, // 100 / 500 / 1000
  prize_pool: { type: Number, default: 0 },
  questions: [{
    q_no: Number,
    question: String,
    options: [String],
    correct_answer: Number, // index of correct option (0-3)
    points: { type: Number, default: 1 }
  }],
  result_date: { type: Date, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true }, // enrollment deadline
  status: {
    type: String,
    enum: ['upcoming', 'active', 'closed', 'result_declared'],
    default: 'upcoming'
  },
  total_participants: { type: Number, default: 0 },
  total_collection: { type: Number, default: 0 },
  winners: [{
    rank: Number,
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    member_id: String,
    name: String,
    enrollment_number: String,
    prize_amount: Number,
    score: Number
  }],
  prizes: {
    first: { type: Number, default: 0 },
    second: { type: Number, default: 0 },
    third: { type: Number, default: 0 }
  },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

quizSchema.index({ type: 1, status: 1 });
quizSchema.index({ result_date: 1 });
quizSchema.index({ start_date: 1, end_date: 1 });

export default mongoose.model('Quiz', quizSchema);
