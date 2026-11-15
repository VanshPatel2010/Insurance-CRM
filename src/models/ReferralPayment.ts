import mongoose from 'mongoose';

const ReferralPaymentSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralMember',
    required: true,
  },
  direction: {
    type: String,
    enum: ['sent', 'received'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  mode: {
    type: String,
    enum: ['cash', 'upi', 'bank', 'cheque', 'adjustment', 'legacy'],
    required: true,
  },
  reference: { type: String, trim: true, default: '' },
  note: { type: String, trim: true, default: '' },
  clientRequestId: { type: String, trim: true },
  source: {
    type: String,
    enum: ['manual', 'migration'],
    default: 'manual',
  },
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ReferralPaymentSchema.index({ agentId: 1, referralId: 1, date: -1 });
ReferralPaymentSchema.index(
  { agentId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientRequestId: { $exists: true, $ne: '' },
    },
  },
);

export default mongoose.models.ReferralPayment ||
  mongoose.model('ReferralPayment', ReferralPaymentSchema);

