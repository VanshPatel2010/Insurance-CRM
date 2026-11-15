// ── referralMath.ts ─────────────────────────────────────────────────────────────
// Pure functions for referral commission and payment ledger calculations.
// The balance formula (single source of truth):
//   balance = totalCommission − totalPremiumPaidByAgency − totalSent + totalReceived
//   balance > 0 → agency owes referral (agency should PAY)
//   balance < 0 → referral owes agency (agency should COLLECT)
//   |balance| < 0.005 → Settled

export type CommissionPolicyInput = {
  type?: string;
  premiumAmount?: unknown;
  premiumWithoutGst?: unknown;
  thirdPartyPremium?: unknown;
  ownDamagePremium?: unknown;
  commissionType?: unknown;
  commissionValue?: unknown;
  premiumPaidByAgency?: unknown;
  details?: Record<string, unknown> | null;
  policyType?: unknown;
  // Legacy fields — kept for migration only, not used in new calculations
  commissionStatus?: unknown;
  paymentReceivedFromReferral?: unknown;
  paymentSentToReferral?: unknown;
};

export type ReferralPaymentInput = {
  direction: 'sent' | 'received';
  amount: number;
  voidedAt?: Date | string | null;
};

export type ReferralLedgerSummary = {
  totalPolicies: number;
  totalCommission: number;
  premiumPaidByAgency: number;
  paymentSentToReferral: number;
  paymentReceivedFromReferral: number;
  balance: number;
  balanceDirection: 'agency_pays' | 'referral_pays' | 'settled';
  amountDue: number;
};

export type PolicySettlementStatus = 'settled' | 'partial' | 'pending';

export type PolicyWithStatus = {
  _id: string;
  status: PolicySettlementStatus;
  policyNet: number;
  cumulativeNet: number;
};

// ── Rounding ────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places, avoiding floating-point drift (e.g. 0.1+0.2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True when the balance is effectively zero (within ₹0.005). Never use === for money. */
export function isSettled(balance: number): boolean {
  return Math.abs(balance) < 0.005;
}

// ── Money parsing ───────────────────────────────────────────────────────────────

export function toMoneyNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Commission calculation (unchanged behaviour) ────────────────────────────────

function motorPolicyType(policy: CommissionPolicyInput) {
  return String(policy.policyType ?? policy.details?.policyType ?? "")
    .trim()
    .toLowerCase();
}

export function isMotorPackagePolicy(policy: CommissionPolicyInput) {
  if (policy.type !== "motor") return false;
  const policyType = motorPolicyType(policy);
  return (
    policyType.includes("package") ||
    policyType.includes("comprehensive") ||
    policyType.includes("full")
  );
}

export function commissionBaseAmount(policy: CommissionPolicyInput) {
  const premiumWithoutGst =
    toMoneyNumber(policy.premiumWithoutGst) || toMoneyNumber(policy.premiumAmount);
  if (isMotorPackagePolicy(policy)) {
    const ownDamagePremium = toMoneyNumber(
      policy.ownDamagePremium ?? policy.details?.ownDamagePremium,
    );
    if (ownDamagePremium > 0) return ownDamagePremium;

    return Math.max(
      premiumWithoutGst - toMoneyNumber(policy.thirdPartyPremium ?? policy.details?.thirdPartyPremium),
      0,
    );
  }
  return premiumWithoutGst;
}

export function commissionAmount(policy: CommissionPolicyInput) {
  const value = toMoneyNumber(policy.commissionValue);
  if (value < 0) {
    // Negative commission is invalid — treat as 0
    if (typeof console !== "undefined") {
      console.warn("Negative commissionValue encountered, treating as 0:", policy.commissionValue);
    }
    return 0;
  }
  if (policy.commissionType === "flat") return round2(value);
  return round2((commissionBaseAmount(policy) * value) / 100);
}

// ── Ledger summary ──────────────────────────────────────────────────────────────

/**
 * Compute the referral ledger summary from policies and payments.
 * Balance is computed ONCE after all loops, never inside a loop.
 * Voided payments (voidedAt set) are excluded from sums.
 */
export function summarizeReferralLedger(
  policies: CommissionPolicyInput[],
  payments: ReferralPaymentInput[],
): ReferralLedgerSummary {
  let totalCommission = 0;
  let premiumPaidByAgency = 0;

  for (const policy of policies) {
    totalCommission += commissionAmount(policy);
    premiumPaidByAgency += toMoneyNumber(policy.premiumPaidByAgency);
  }

  let paymentSentToReferral = 0;
  let paymentReceivedFromReferral = 0;

  for (const payment of payments) {
    if (payment.voidedAt) continue;
    if (payment.direction === 'sent') paymentSentToReferral += payment.amount;
    else paymentReceivedFromReferral += payment.amount;
  }

  totalCommission = round2(totalCommission);
  premiumPaidByAgency = round2(premiumPaidByAgency);
  paymentSentToReferral = round2(paymentSentToReferral);
  paymentReceivedFromReferral = round2(paymentReceivedFromReferral);

  const balance = round2(
    totalCommission - premiumPaidByAgency - paymentSentToReferral + paymentReceivedFromReferral,
  );

  return {
    totalPolicies: policies.length,
    totalCommission,
    premiumPaidByAgency,
    paymentSentToReferral,
    paymentReceivedFromReferral,
    balance,
    balanceDirection: isSettled(balance)
      ? 'settled'
      : balance > 0
        ? 'agency_pays'
        : 'referral_pays',
    amountDue: round2(Math.abs(balance)),
  };
}

// ── Per-policy settlement status (derived, display-only, never stored) ──────────

/**
 * Derive per-policy settlement status from the payment ledger.
 * This is for display purposes only — the balance is authoritative.
 *
 * Logic:
 * - Sort policies by startDate ascending (tie-break by _id).
 * - cashSettled = totalSent − totalReceived (non-voided payments).
 *   This represents the net commission cash movement.
 * - Walk through policies in order, accumulating policyNet (commission − agencyPaid).
 * - A policy is "settled" if cumulative net ≤ cashSettled; "partial" if the
 *   cash boundary falls within this policy; otherwise "pending".
 */
export function computePolicyStatuses(
  policies: (CommissionPolicyInput & { _id: string; startDate?: string })[],
  payments: ReferralPaymentInput[],
): PolicyWithStatus[] {
  const sorted = [...policies].sort((a, b) => {
    const dateA = String(a.startDate ?? '');
    const dateB = String(b.startDate ?? '');
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    return String(a._id) < String(b._id) ? -1 : 1;
  });

  let cashSettled = 0;
  for (const p of payments) {
    if (p.voidedAt) continue;
    if (p.direction === 'sent') cashSettled += p.amount;
    else cashSettled -= p.amount;
  }
  cashSettled = round2(cashSettled);

  let cumulative = 0;
  return sorted.map((policy) => {
    const policyNet = round2(
      commissionAmount(policy) - toMoneyNumber(policy.premiumPaidByAgency),
    );
    const prevCumulative = cumulative;
    cumulative = round2(cumulative + policyNet);

    let status: PolicySettlementStatus;
    if (cumulative <= cashSettled + 0.005) {
      status = 'settled';
    } else if (prevCumulative < cashSettled - 0.005) {
      status = 'partial';
    } else {
      status = 'pending';
    }

    return {
      _id: String(policy._id),
      status,
      policyNet,
      cumulativeNet: cumulative,
    };
  });
}
