import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  order_id:         { type: String, required: true, unique: true },
  product_id:       { type: String, required: true },
  product_title:    { type: String },
  buyer_name:       { type: String, required: true },
  buyer_contact:    { type: String, required: true },
  buyer_email:      { type: String },
  buyer_address:    { type: String },
  seller_user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  seller_member_id: { type: String },
  quantity:         { type: Number, default: 1 },
  unit_price:       { type: Number, required: true },
  total_amount:     { type: Number, required: true },
  payment_mode:     { type: String, default: 'online' },
  status:           { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'], default: 'pending' },
  tracking_info:    { type: String },
  notes:            { type: String },
  created_at:       { type: Date, default: Date.now },
  updated_at:       { type: Date, default: Date.now }
});

orderSchema.index({ seller_user_id: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ product_id: 1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
