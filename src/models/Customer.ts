import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['motor', 'medical', 'fire', 'life'],
    required: true,
  },

  // ── Common fields ──────────────────────────────────────────────────────────
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  policyNumber: { type: String, required: true, trim: true },
  premiumAmount: { type: String, required: true },
  sumInsured: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },

  // ── Type-specific fields (flexible per-type sub-document) ──────────────────
  // Motor:   { vehicleMake, vehicleModel, vehicleYear, registrationNumber,
  //            engineCC, fuelType, idvValue, ncbPercent, addOns }
  // Medical: { dateOfBirth, age, gender, bloodGroup, preExistingConditions,
  //            smoker, numberOfMembers, members, cashlessHospitalNetwork }
  // Fire:    { propertyType, propertyAddress, builtUpArea, constructionType,
  //            propertyValue, stockValue, riskLocation }
  // Life:    { dateOfBirth, age, gender, occupation, annualIncome, smoker,
  //            nomineeName, nomineeRelation, lifePolicyType, sumAssured,
  //            premiumFrequency, maturityDate, policyTerm }
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});



// Compound indexes for fast, scoped queries
CustomerSchema.index({ agentId: 1, type: 1 });
CustomerSchema.index({ agentId: 1, endDate: 1 });
CustomerSchema.index({ agentId: 1, policyNumber: 1 });

export default mongoose.models.Customer ||
  mongoose.model('Customer', CustomerSchema);
