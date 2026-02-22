import mongoose from 'mongoose';

const socialTaskSchema = new mongoose.Schema({
  task_id: { type: String, required: true, unique: true },
  week_number: { type: Number, required: true, min: 1, max: 10 },
  title: { type: String, required: true },
  description: { type: String, required: true },
  photo_instruction: { type: String, required: true },
  icon: { type: String, default: '🌱' },
  points_reward: { type: Number, default: 10 },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

socialTaskSchema.index({ week_number: 1 });
socialTaskSchema.index({ is_active: 1 });

export default mongoose.model('SocialTask', socialTaskSchema);
