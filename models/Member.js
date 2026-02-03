import mongoose from "mongoose";
const MemberSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  mobile:   { type: String, required: true, trim: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  aadhar:   { type: String, trim: true },
  pan:      { type: String, trim: true },
  project:  { type: String, trim: true },
  paymentRef: { type: String, trim: true },
  paymentProof: { type: String } // Base64 image/PDF
}, { timestamps: true });

export default mongoose.models.Member || mongoose.model("Member", MemberSchema);