import mongoose from 'mongoose';

const FamilyGroupSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },
  familyName: { type: String, required: true, trim: true },
  primaryPolicyholderName: { type: String, required: true, trim: true },
  primaryPhone: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

FamilyGroupSchema.index({ agentId: 1, familyName: 1 });

export default mongoose.models.FamilyGroup ||
  mongoose.model('FamilyGroup', FamilyGroupSchema);
