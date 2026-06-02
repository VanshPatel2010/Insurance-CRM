export type CommissionPolicyInput = {
  type?: string;
  premiumAmount?: unknown;
  premiumWithoutGst?: unknown;
  thirdPartyPremium?: unknown;
  ownDamagePremium?: unknown;
  commissionType?: unknown;
  commissionValue?: unknown;
  commissionStatus?: unknown;
  premiumPaidByAgency?: unknown;
  paymentReceivedFromReferral?: unknown;
  paymentSentToReferral?: unknown;
  details?: Record<string, unknown> | null;
  policyType?: unknown;
};

export type ReferralSummary = {
  totalPolicies: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  premiumPaidByAgency: number;
  paymentReceivedFromReferral: number;
  paymentSentToReferral: number;
  netAmount: number;
};

export function toMoneyNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  if (policy.commissionType === "flat") return value;
  return (commissionBaseAmount(policy) * value) / 100;
}

export function emptyReferralSummary(): ReferralSummary {
  return {
    totalPolicies: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
    premiumPaidByAgency: 0,
    paymentReceivedFromReferral: 0,
    paymentSentToReferral: 0,
    netAmount: 0,
  };
}

export function summarizeReferralPolicies(policies: CommissionPolicyInput[]) {
  return policies.reduce((summary, policy) => {
    const amount = commissionAmount(policy);
    summary.totalPolicies += 1;
    summary.totalCommission += amount;
    if (policy.commissionStatus === "Paid") summary.paidCommission += amount;
    else summary.pendingCommission += amount;
    summary.premiumPaidByAgency += toMoneyNumber(policy.premiumPaidByAgency);
    summary.paymentReceivedFromReferral += toMoneyNumber(policy.paymentReceivedFromReferral);
    summary.paymentSentToReferral += toMoneyNumber(policy.paymentSentToReferral);
    summary.netAmount =
      summary.premiumPaidByAgency -
      summary.pendingCommission -
      summary.paymentReceivedFromReferral +
      summary.paymentSentToReferral;
    return summary;
  }, emptyReferralSummary());
}
