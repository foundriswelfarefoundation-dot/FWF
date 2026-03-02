import mongoose from 'mongoose';

// Generic key-value store for app configuration
// Used for: Zoho refresh token, feature flags, etc.
const AppConfigSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  value:     { type: String },
  meta:      { type: mongoose.Schema.Types.Mixed },  // extra info
  updated_at: { type: Date, default: Date.now }
});

export default mongoose.models.AppConfig || mongoose.model('AppConfig', AppConfigSchema);
