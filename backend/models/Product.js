import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id:       { type: String, required: true, unique: true },
  seller_user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller_name:      { type: String },
  seller_member_id: { type: String },
  title:            { type: String, required: true },
  description:      { type: String },
  category:         { type: String, required: true },
  subcategory:      { type: String },
  brand:            { type: String },
  price:            { type: Number, required: true },
  mrp:              { type: Number },
  discount_percent: { type: Number, default: 0 },
  stock:            { type: Number, default: 1 },
  unit:             { type: String, default: 'piece' },
  weight:           { type: String },
  dimensions:       { type: String },
  material:         { type: String },
  color:            { type: String },
  size:             { type: String },
  tags:             { type: String },
  images:           [{ type: String }],
  thumbnail:        { type: String },
  condition:        { type: String, enum: ['new', 'used', 'refurbished', 'handmade'], default: 'new' },
  status:           { type: String, enum: ['pending', 'approved', 'rejected', 'out-of-stock', 'deleted'], default: 'pending' },
  admin_notes:      { type: String },
  featured:         { type: Boolean, default: false },
  rating_avg:       { type: Number, default: 0 },
  rating_count:     { type: Number, default: 0 },
  views:            { type: Number, default: 0 },
  total_sold:       { type: Number, default: 0 },
  created_at:       { type: Date, default: Date.now },
  updated_at:       { type: Date, default: Date.now }
});

productSchema.index({ seller_user_id: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ featured: -1, created_at: -1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);
