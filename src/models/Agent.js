import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false, // Exclude password from query results by default
  },
  agencyName: {
    type: String,
    required: [true, 'Agency name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  licenseNumber: {
    type: String,
    trim: true,
    default: null,
  },
  // Email Verification
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: null,
  },
  verificationTokenExpires: {
    type: Date,
    default: null,
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  // Subscription & Account Management
  isAdmin: {
    type: Boolean,
    default: false,
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'trial'],
    default: 'trial',
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free',
  },
  subscriptionStartDate: {
    type: Date,
    default: null,
  },
  subscriptionEndDate: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

AgentSchema.index(
  { verificationToken: 1, verificationTokenExpires: 1 },
  {
    partialFilterExpression: {
      verificationToken: { $exists: true, $ne: null },
    },
  }
);

AgentSchema.index(
  { resetPasswordToken: 1 },
  {
    partialFilterExpression: {
      resetPasswordToken: { $exists: true, $ne: null },
    },
  }
);

// Prevent model recompilation during Next.js hot reloads
export default mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
