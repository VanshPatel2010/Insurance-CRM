import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CompanySchema.index({ agentId: 1, normalizedName: 1 }, { unique: true });

export function normalizeCompanyName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default mongoose.models.Company ||
  mongoose.model("Company", CompanySchema);
