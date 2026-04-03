/**
 * providerUsage.ts
 *
 * MongoDB-backed daily usage counter for each AI provider.
 * Each document tracks { providerId, date, count } for a single UTC day.
 * Falls back gracefully if MongoDB is unavailable — it logs a warning and
 * allows the call through rather than blocking extraction.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { connectDB } from '@/lib/mongodb';

// ─── Daily limits per provider ────────────────────────────────────────────────

export const PROVIDER_LIMITS: Record<string, number> = {
  gemini: 1000,       // Gemini 2.5 Flash Lite free tier
  groq: 14400,        // Groq free tier (~10 req/min × 24 h)
  huggingface: 2000,  // HuggingFace Inference API (practical throttle guard)
  together: 2000,     // Together AI $1 free credit guard
};

// ─── Mongoose model ───────────────────────────────────────────────────────────

interface IProviderUsage extends Document {
  providerId: string;
  date: string; // YYYY-MM-DD UTC
  count: number;
}

const providerUsageSchema = new Schema<IProviderUsage>({
  providerId: { type: String, required: true },
  date:       { type: String, required: true },
  count:      { type: Number, default: 0 },
});

providerUsageSchema.index({ providerId: 1, date: 1 }, { unique: true });

const ProviderUsage: Model<IProviderUsage> =
  (mongoose.models.ProviderUsage as Model<IProviderUsage>) ||
  mongoose.model<IProviderUsage>('ProviderUsage', providerUsageSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date string in UTC (YYYY-MM-DD). */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns how many calls have been made to `providerId` today.
 * Returns 0 on any error so availability checks are never blocked.
 */
export async function getUsageToday(providerId: string): Promise<number> {
  try {
    await connectDB();
    const doc = await ProviderUsage.findOne({ providerId, date: todayUTC() });
    return doc?.count ?? 0;
  } catch (err) {
    console.warn(`[providerUsage] Could not read usage for "${providerId}":`, err);
    return 0;
  }
}

/**
 * Atomically increments the counter for `providerId` today.
 * Upserts so the first call of the day creates the document automatically.
 * Silently swallows errors — a failed counter must never break extraction.
 */
export async function incrementUsage(providerId: string): Promise<void> {
  try {
    await connectDB();
    await ProviderUsage.findOneAndUpdate(
      { providerId, date: todayUTC() },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err) {
    console.warn(`[providerUsage] Could not increment usage for "${providerId}":`, err);
  }
}

/**
 * Returns true if the provider has budget remaining for today.
 * Unknown provider IDs return false.
 */
export async function isProviderAvailable(providerId: string): Promise<boolean> {
  const limit = PROVIDER_LIMITS[providerId];
  if (limit == null) return false;
  const used = await getUsageToday(providerId);
  return used < limit;
}
