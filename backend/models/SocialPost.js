import mongoose from 'mongoose';

const socialPostSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  member_id: { type: String, required: true },
  user_name: { type: String, required: true },
  user_avatar: { type: String },
  post_type: { type: String, enum: ['welfare', 'training', 'health', 'plantation', 'education', 'donation', 'awareness', 'skill', 'task_completion', 'other'], default: 'other' },
  content: { type: String, required: true },
  images: [{ type: String }], // base64 or URLs
  task_completion_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskCompletion' },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'pending', 'removed'], default: 'active' },
  is_auto_generated: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

socialPostSchema.index({ created_at: -1 });
socialPostSchema.index({ user_id: 1, created_at: -1 });
socialPostSchema.index({ post_type: 1 });

export default mongoose.model('SocialPost', socialPostSchema);
