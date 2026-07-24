import mongoose from 'mongoose';

const ClaimSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  claimNumber: {
    type: String,
    required: true,
    trim: true,
  },
  claimDate: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  claimAmount: {
    type: String,
    required: true,
  },
  settledAmount: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Filed', 'Under Review', 'Approved', 'Settled', 'Rejected'],
    default: 'Filed',
  },
  notes: [{
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ClaimSchema.index({ agentId: 1, claimNumber: 1 }, { unique: true });
ClaimSchema.index({ agentId: 1, customerId: 1 });
ClaimSchema.index({ agentId: 1, status: 1 });
ClaimSchema.index({ agentId: 1, createdAt: -1 });

export default mongoose.models.Claim || mongoose.model('Claim', ClaimSchema);
