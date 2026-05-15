import mongoose from 'mongoose';

const ReferralMemberSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ReferralMemberSchema.index({ agentId: 1, name: 1 });

export default mongoose.models.ReferralMember ||
  mongoose.model('ReferralMember', ReferralMemberSchema);
