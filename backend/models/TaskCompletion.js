import mongoose from 'mongoose';

const taskCompletionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  member_id: { type: String, required: true },
  task_id: { type: String, required: true },
  week_number: { type: Number, required: true },
  year_week: { type: String }, // legacy field, kept for backward compat
  photo_url: { type: String, required: true },
  photo_timestamp: { type: Date, default: Date.now },
  latitude: { type: Number },
  longitude: { type: Number },
  location_address: { type: String },
  points_earned: { type: Number, default: 10 },
  status: { type: String, enum: ['completed', 'approved', 'rejected'], default: 'completed' },
  social_post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialPost' },
  completed_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'completed_at', updatedAt: false }
});

// Prevent duplicate — one completion per user per task
taskCompletionSchema.index({ user_id: 1, task_id: 1 }, { unique: true });
taskCompletionSchema.index({ completed_at: -1 });
taskCompletionSchema.index({ member_id: 1 });

export default mongoose.model('TaskCompletion', taskCompletionSchema);
