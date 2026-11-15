#!/usr/bin/env npx tsx
/**
 * migrate-referral-ledger.ts
 * ──────────────────────────
 * Converts legacy per-policy tick-marks and inline payment fields into
 * proper ReferralPayment ledger entries.
 *
 * ⚠️  TAKE A DATABASE BACKUP BEFORE RUNNING WITH --apply  ⚠️
 *
 * Usage:
 *   npx tsx scripts/migrate-referral-ledger.ts              # dry-run (default)
 *   npx tsx scripts/migrate-referral-ledger.ts --dry-run    # explicit dry-run
 *   npx tsx scripts/migrate-referral-ledger.ts --apply      # write to database
 *
 * What it does:
 *   1. For each referral member, finds all policies with referredById = member._id.
 *   2. Sums legacy paymentSentToReferral across policies  →  total legacy "sent".
 *   3. Sums legacy paymentReceivedFromReferral              →  total legacy "received".
 *   4. For policies marked commissionStatus=Paid that have NO paymentSentToReferral,
 *      adds their commission amount to the "sent" total (tick = implied payment).
 *   5. Creates at most one ReferralPayment { direction:'sent', mode:'legacy' }
 *      and one { direction:'received', mode:'legacy' } per referral, with source:'migration'.
 *   6. Skips referrals that already have source:'migration' payments (idempotent).
 *   7. Flags policies where BOTH commissionStatus=Paid AND paymentSentToReferral > 0
 *      and they differ — potential double-count that needs manual review.
 *
 * Environment:
 *   Reads MONGODB_URI from .env.local (via dotenv) or from environment.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// ── Import models ──────────────────────────────────────────────────────────────
// We import models to register them with mongoose. The files use the
// mongoose.models.X || mongoose.model(...) guard so re-import is safe.
import '../src/models/ReferralMember';
import '../src/models/ReferralPayment';
import '../src/models/Customer';

// ── Import math helpers ────────────────────────────────────────────────────────
import {
  commissionAmount,
  toMoneyNumber,
  round2,
  summarizeReferralLedger,
  type CommissionPolicyInput,
} from '../src/lib/referralMath';

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const dryRun = !applyMode; // default is dry-run

// ── Types ──────────────────────────────────────────────────────────────────────
interface MigrationResult {
  referralId: string;
  referralName: string;
  agentId: string;
  totalPolicies: number;
  legacySent: number;
  legacyReceived: number;
  tickImpliedSent: number;      // from commissionStatus=Paid with no paymentSentToReferral
  totalMigratedSent: number;    // legacySent + tickImpliedSent
  totalMigratedReceived: number;
  balanceAfterMigration: number;
  flaggedPolicies: FlaggedPolicy[];
  skipped: boolean;
  skipReason?: string;
}

interface FlaggedPolicy {
  policyId: string;
  policyNumber: string;
  customerName: string;
  commissionAmount: number;
  paymentSentToReferral: number;
  reason: string;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found. Set it in .env.local or environment.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Referral Ledger Migration — ${dryRun ? '🔍 DRY RUN' : '⚡ APPLY MODE'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  if (!dryRun) {
    console.log('⚠️  This will WRITE to the database. Ctrl+C within 5 seconds to abort.');
    await sleep(5000);
  }

  // Connect to MongoDB
  console.log('\n🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('✅ Connected.\n');

  const ReferralMember = mongoose.models.ReferralMember;
  const ReferralPayment = mongoose.models.ReferralPayment;
  const Customer = mongoose.models.Customer;

  // Fetch all referral members
  const referrals = await ReferralMember.find({}).lean();
  console.log(`📋 Found ${referrals.length} referral member(s).\n`);

  const results: MigrationResult[] = [];
  let skippedCount = 0;
  let migratedCount = 0;
  let flaggedCount = 0;
  let createdPayments = 0;

  for (const referral of referrals) {
    const refId = String(referral._id);
    const agentId = String(referral.agentId);

    // Check if already migrated (idempotency)
    const existingMigration = await ReferralPayment.findOne({
      referralId: referral._id,
      agentId: referral.agentId,
      source: 'migration',
    }).lean();

    if (existingMigration) {
      results.push({
        referralId: refId,
        referralName: referral.name,
        agentId,
        totalPolicies: 0,
        legacySent: 0,
        legacyReceived: 0,
        tickImpliedSent: 0,
        totalMigratedSent: 0,
        totalMigratedReceived: 0,
        balanceAfterMigration: 0,
        flaggedPolicies: [],
        skipped: true,
        skipReason: 'Already migrated (has source:migration payments)',
      });
      skippedCount++;
      continue;
    }

    // Fetch all policies for this referral
    const policies = await Customer.find({
      agentId: referral.agentId,
      referredById: referral._id,
    }).lean();

    if (policies.length === 0) {
      results.push({
        referralId: refId,
        referralName: referral.name,
        agentId,
        totalPolicies: 0,
        legacySent: 0,
        legacyReceived: 0,
        tickImpliedSent: 0,
        totalMigratedSent: 0,
        totalMigratedReceived: 0,
        balanceAfterMigration: 0,
        flaggedPolicies: [],
        skipped: true,
        skipReason: 'No policies',
      });
      skippedCount++;
      continue;
    }

    let legacySent = 0;
    let legacyReceived = 0;
    let tickImpliedSent = 0;
    const flaggedPolicies: FlaggedPolicy[] = [];

    for (const policy of policies) {
      const policyCommission = commissionAmount(policy as unknown as CommissionPolicyInput);
      const policyPaymentSent = toMoneyNumber(policy.paymentSentToReferral);
      const policyPaymentReceived = toMoneyNumber(policy.paymentReceivedFromReferral);
      const isPaid = policy.commissionStatus === 'Paid';

      // Sum explicit legacy payment fields
      legacySent += policyPaymentSent;
      legacyReceived += policyPaymentReceived;

      // Flag: policy has BOTH commissionStatus=Paid AND paymentSentToReferral > 0
      // and they differ — possible double-count
      if (isPaid && policyPaymentSent > 0) {
        const diff = Math.abs(policyCommission - policyPaymentSent);
        if (diff > 0.01) {
          flaggedPolicies.push({
            policyId: String(policy._id),
            policyNumber: policy.policyNumber || '(no number)',
            customerName: policy.customerName || '(unknown)',
            commissionAmount: policyCommission,
            paymentSentToReferral: policyPaymentSent,
            reason: `commissionStatus=Paid AND paymentSentToReferral=${policyPaymentSent} ≠ commission=${policyCommission}`,
          });
          flaggedCount++;
        }
        // When both are set, we already counted paymentSentToReferral in legacySent.
        // Do NOT also add commission (would double-count).
        continue;
      }

      // Tick = Paid with no explicit payment → implied payment of commission amount
      if (isPaid && policyPaymentSent === 0 && policyCommission > 0) {
        tickImpliedSent += policyCommission;
      }
    }

    legacySent = round2(legacySent);
    legacyReceived = round2(legacyReceived);
    tickImpliedSent = round2(tickImpliedSent);

    const totalMigratedSent = round2(legacySent + tickImpliedSent);
    const totalMigratedReceived = round2(legacyReceived);

    // Compute what the balance will be after migration
    const migratedPayments: { direction: 'sent' | 'received'; amount: number; voidedAt: null }[] = [];
    if (totalMigratedSent > 0) {
      migratedPayments.push({ direction: 'sent', amount: totalMigratedSent, voidedAt: null });
    }
    if (totalMigratedReceived > 0) {
      migratedPayments.push({ direction: 'received', amount: totalMigratedReceived, voidedAt: null });
    }

    const summary = summarizeReferralLedger(
      policies as unknown as CommissionPolicyInput[],
      migratedPayments,
    );

    // Create payment documents (only in apply mode)
    if (!dryRun) {
      const now = new Date();
      if (totalMigratedSent > 0) {
        await ReferralPayment.create({
          agentId: referral.agentId,
          referralId: referral._id,
          direction: 'sent',
          amount: totalMigratedSent,
          date: now,
          mode: 'legacy',
          reference: '',
          note: `Migration: ₹${legacySent} from legacy paymentSentToReferral + ₹${tickImpliedSent} from commissionStatus=Paid tick marks`,
          source: 'migration',
        });
        createdPayments++;
      }
      if (totalMigratedReceived > 0) {
        await ReferralPayment.create({
          agentId: referral.agentId,
          referralId: referral._id,
          direction: 'received',
          amount: totalMigratedReceived,
          date: now,
          mode: 'legacy',
          reference: '',
          note: `Migration: ₹${totalMigratedReceived} from legacy paymentReceivedFromReferral fields`,
          source: 'migration',
        });
        createdPayments++;
      }
    }

    results.push({
      referralId: refId,
      referralName: referral.name,
      agentId,
      totalPolicies: policies.length,
      legacySent,
      legacyReceived,
      tickImpliedSent,
      totalMigratedSent,
      totalMigratedReceived,
      balanceAfterMigration: summary.balance,
      flaggedPolicies,
      skipped: false,
    });
    migratedCount++;
  }

  // ── Print results ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const r of results) {
    if (r.skipped) {
      console.log(`⏭️  ${r.referralName} (${r.referralId})`);
      console.log(`   Skipped: ${r.skipReason}\n`);
      continue;
    }

    const balanceLabel = r.balanceAfterMigration > 0.005
      ? `You pay ₹${Math.abs(r.balanceAfterMigration)}`
      : r.balanceAfterMigration < -0.005
        ? `They pay ₹${Math.abs(r.balanceAfterMigration)}`
        : 'Settled ✓';

    console.log(`📌 ${r.referralName} (${r.referralId})`);
    console.log(`   Policies:          ${r.totalPolicies}`);
    console.log(`   Legacy Sent:       ₹${r.legacySent}`);
    console.log(`   Tick-Implied Sent: ₹${r.tickImpliedSent}`);
    console.log(`   → Total Sent:      ₹${r.totalMigratedSent}`);
    console.log(`   Legacy Received:   ₹${r.legacyReceived}`);
    console.log(`   → Total Received:  ₹${r.totalMigratedReceived}`);
    console.log(`   Balance After:     ${balanceLabel} (${r.balanceAfterMigration})`);

    if (r.flaggedPolicies.length > 0) {
      console.log(`   ⚠️  FLAGGED POLICIES (${r.flaggedPolicies.length}):`);
      for (const f of r.flaggedPolicies) {
        console.log(`      • ${f.customerName} (${f.policyNumber}): ${f.reason}`);
      }
    }
    console.log('');
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Total referrals:   ${results.length}`);
  console.log(`  Migrated:          ${migratedCount}`);
  console.log(`  Skipped:           ${skippedCount}`);
  console.log(`  Flagged policies:  ${flaggedCount}`);
  if (!dryRun) {
    console.log(`  Payments created:  ${createdPayments}`);
  }
  console.log('───────────────────────────────────────────────────────────────');
  if (dryRun) {
    console.log('\n🔍 DRY RUN — no changes written. Run with --apply to execute.');
  } else {
    console.log('\n✅ Migration complete. Payments have been created.');
  }

  // Disconnect
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

