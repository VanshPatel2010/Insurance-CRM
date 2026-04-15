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
    minlength: [6, 'Password must be at least 6 characters'],
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

// Prevent model recompilation during Next.js hot reloads
export default mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
