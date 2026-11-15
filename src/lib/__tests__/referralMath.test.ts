import { describe, it, expect } from 'vitest';
import {
  round2,
  isSettled,
  toMoneyNumber,
  commissionAmount,
  commissionBaseAmount,
  isMotorPackagePolicy,
  summarizeReferralLedger,
  computePolicyStatuses,
  type CommissionPolicyInput,
  type ReferralPaymentInput,
} from '../referralMath';

// ── Helper to build minimal policy objects ──────────────────────────────────────

function makePolicy(
  overrides: Partial<CommissionPolicyInput> & { _id?: string; startDate?: string } = {},
): CommissionPolicyInput & { _id: string; startDate: string } {
  return {
    _id: overrides._id ?? 'p1',
    startDate: overrides.startDate ?? '2025-01-01',
    type: 'medical',
    commissionType: 'flat',
    commissionValue: '0',
    premiumAmount: '0',
    premiumPaidByAgency: '0',
    ...overrides,
  } as CommissionPolicyInput & { _id: string; startDate: string };
}

function makeSent(amount: number, voided = false): ReferralPaymentInput {
  return { direction: 'sent', amount, voidedAt: voided ? new Date() : null };
}

function makeReceived(amount: number, voided = false): ReferralPaymentInput {
  return { direction: 'received', amount, voidedAt: voided ? new Date() : null };
}

// ── round2 ──────────────────────────────────────────────────────────────────────

describe('round2', () => {
  it('rounds 0.1 + 0.2 to 0.3', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('rounds down at boundary', () => {
    expect(round2(1.234)).toBe(1.23);
  });

  it('rounds up at boundary', () => {
    expect(round2(1.235)).toBe(1.24);
  });

  it('handles zero', () => {
    expect(round2(0)).toBe(0);
  });

  it('handles negative', () => {
    expect(round2(-1.555)).toBe(-1.55);
  });

  it('handles already rounded', () => {
    expect(round2(10378)).toBe(10378);
  });
});

// ── isSettled ───────────────────────────────────────────────────────────────────

describe('isSettled', () => {
  it('returns true for 0', () => {
    expect(isSettled(0)).toBe(true);
  });

  it('returns true for 0.004', () => {
    expect(isSettled(0.004)).toBe(true);
  });

  it('returns false for 0.005', () => {
    expect(isSettled(0.005)).toBe(false);
  });

  it('returns true for -0.004', () => {
    expect(isSettled(-0.004)).toBe(true);
  });

  it('returns false for -0.01', () => {
    expect(isSettled(-0.01)).toBe(false);
  });
});

// ── toMoneyNumber ───────────────────────────────────────────────────────────────

describe('toMoneyNumber', () => {
  it('parses string numbers', () => {
    expect(toMoneyNumber('1234')).toBe(1234);
  });

  it('strips non-numeric chars', () => {
    expect(toMoneyNumber('₹1,23,456')).toBe(123456);
  });

  it('returns 0 for empty', () => {
    expect(toMoneyNumber('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(toMoneyNumber(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toMoneyNumber(undefined)).toBe(0);
  });

  it('handles numeric input', () => {
    expect(toMoneyNumber(42.5)).toBe(42.5);
  });
});

// ── commissionAmount ────────────────────────────────────────────────────────────

describe('commissionAmount', () => {
  it('calculates flat commission', () => {
    const policy = makePolicy({ commissionType: 'flat', commissionValue: '5000' });
    expect(commissionAmount(policy)).toBe(5000);
  });

  it('calculates percentage commission', () => {
    const policy = makePolicy({
      commissionType: 'percentage',
      commissionValue: '10',
      premiumAmount: '10000',
    });
    expect(commissionAmount(policy)).toBe(1000);
  });

  it('handles 12.5% of 3651 with proper rounding', () => {
    const policy = makePolicy({
      commissionType: 'percentage',
      commissionValue: '12.5',
      premiumAmount: '3651',
    });
    expect(commissionAmount(policy)).toBe(456.38);
  });

  it('treats negative commissionValue as 0', () => {
    const policy = makePolicy({ commissionType: 'flat', commissionValue: '-100' });
    expect(commissionAmount(policy)).toBe(0);
  });

  it('treats empty commissionValue as 0', () => {
    const policy = makePolicy({ commissionType: 'percentage', commissionValue: '' });
    expect(commissionAmount(policy)).toBe(0);
  });

  it('treats NaN commissionValue as 0', () => {
    const policy = makePolicy({ commissionType: 'flat', commissionValue: 'abc' });
    expect(commissionAmount(policy)).toBe(0);
  });

  it('uses premiumWithoutGst when available', () => {
    const policy = makePolicy({
      commissionType: 'percentage',
      commissionValue: '10',
      premiumAmount: '11800',
      premiumWithoutGst: '10000',
    });
    expect(commissionAmount(policy)).toBe(1000);
  });
});

// ── Motor package commission base ───────────────────────────────────────────────

describe('commissionBaseAmount (motor package)', () => {
  it('uses ownDamagePremium for motor package policy', () => {
    const policy = makePolicy({
      type: 'motor',
      policyType: 'Package',
      premiumAmount: '20000',
      premiumWithoutGst: '18000',
      ownDamagePremium: '12000',
    });
    expect(isMotorPackagePolicy(policy)).toBe(true);
    expect(commissionBaseAmount(policy)).toBe(12000);
  });

  it('falls back to premiumWithoutGst - thirdPartyPremium for motor package', () => {
    const policy = makePolicy({
      type: 'motor',
      policyType: 'comprehensive',
      premiumAmount: '20000',
      premiumWithoutGst: '18000',
      thirdPartyPremium: '5000',
    });
    expect(commissionBaseAmount(policy)).toBe(13000);
  });

  it('returns premiumWithoutGst for non-motor', () => {
    const policy = makePolicy({
      type: 'medical',
      premiumAmount: '20000',
      premiumWithoutGst: '18000',
    });
    expect(commissionBaseAmount(policy)).toBe(18000);
  });
});

// ── summarizeReferralLedger ─────────────────────────────────────────────────────

describe('summarizeReferralLedger', () => {
  describe('reference numbers from spec', () => {
    it('commission 10378, agencyPaid 8468, no payments → balance +1910', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '10378', premiumPaidByAgency: '8468' }),
      ];
      const result = summarizeReferralLedger(policies, []);
      expect(result.totalCommission).toBe(10378);
      expect(result.premiumPaidByAgency).toBe(8468);
      expect(result.balance).toBe(1910);
      expect(result.balanceDirection).toBe('agency_pays');
      expect(result.amountDue).toBe(1910);
    });

    it('sent 1910 → balance 0 (settled)', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '10378', premiumPaidByAgency: '8468' }),
      ];
      const payments = [makeSent(1910)];
      const result = summarizeReferralLedger(policies, payments);
      expect(result.balance).toBe(0);
      expect(result.balanceDirection).toBe('settled');
    });

    it('sent 10378 instead → balance -8468', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '10378', premiumPaidByAgency: '8468' }),
      ];
      const payments = [makeSent(10378)];
      const result = summarizeReferralLedger(policies, payments);
      expect(result.balance).toBe(-8468);
      expect(result.balanceDirection).toBe('referral_pays');
      expect(result.amountDue).toBe(8468);
    });

    it('sent 10378 then received 8468 → balance 0', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '10378', premiumPaidByAgency: '8468' }),
      ];
      const payments = [makeSent(10378), makeReceived(8468)];
      const result = summarizeReferralLedger(policies, payments);
      expect(result.balance).toBe(0);
      expect(result.balanceDirection).toBe('settled');
    });

    it('overpayment: balance 1910, sent 2000 → balance -90', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '10378', premiumPaidByAgency: '8468' }),
      ];
      const payments = [makeSent(2000)];
      const result = summarizeReferralLedger(policies, payments);
      expect(result.balance).toBe(-90);
      expect(result.balanceDirection).toBe('referral_pays');
      expect(result.amountDue).toBe(90);
    });
  });

  describe('7-policy example', () => {
    const sevenPolicies = [
      makePolicy({ _id: 'p1', startDate: '2025-01-01', commissionType: 'flat', commissionValue: '737', premiumPaidByAgency: '0' }),
      makePolicy({ _id: 'p2', startDate: '2025-02-01', commissionType: 'flat', commissionValue: '1291', premiumPaidByAgency: '0' }),
      makePolicy({ _id: 'p3', startDate: '2025-03-01', commissionType: 'flat', commissionValue: '800', premiumPaidByAgency: '0' }),
      makePolicy({ _id: 'p4', startDate: '2025-04-01', commissionType: 'flat', commissionValue: '5932', premiumPaidByAgency: '0' }),
      makePolicy({ _id: 'p5', startDate: '2025-05-01', commissionType: 'flat', commissionValue: '705', premiumPaidByAgency: '4160' }),
      makePolicy({ _id: 'p6', startDate: '2025-06-01', commissionType: 'flat', commissionValue: '913', premiumPaidByAgency: '4308' }),
      makePolicy({ _id: 'p7', startDate: '2025-07-01', commissionType: 'flat', commissionValue: '0', premiumPaidByAgency: '0' }),
    ];

    it('totals match expected values', () => {
      const result = summarizeReferralLedger(sevenPolicies, []);
      expect(result.totalPolicies).toBe(7);
      expect(result.totalCommission).toBe(10378);
      expect(result.premiumPaidByAgency).toBe(8468);
      expect(result.balance).toBe(1910);
      expect(result.balanceDirection).toBe('agency_pays');
    });

    it('after sent 1910, every policy is settled', () => {
      const result = summarizeReferralLedger(sevenPolicies, [makeSent(1910)]);
      expect(result.balance).toBe(0);
      expect(result.balanceDirection).toBe('settled');
    });
  });

  describe('edge cases', () => {
    it('empty inputs return settled with zeros', () => {
      const result = summarizeReferralLedger([], []);
      expect(result.totalPolicies).toBe(0);
      expect(result.totalCommission).toBe(0);
      expect(result.premiumPaidByAgency).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.balanceDirection).toBe('settled');
      expect(result.amountDue).toBe(0);
    });

    it('voided payments are ignored', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '1000' }),
      ];
      const payments = [makeSent(1000, true)]; // voided
      const result = summarizeReferralLedger(policies, payments);
      expect(result.balance).toBe(1000);
      expect(result.paymentSentToReferral).toBe(0);
    });

    it('floating point: percentage amounts sum correctly', () => {
      const policies = [
        makePolicy({ commissionType: 'percentage', commissionValue: '10', premiumAmount: '1001' }),
        makePolicy({ _id: 'p2', commissionType: 'percentage', commissionValue: '10', premiumAmount: '1002' }),
        makePolicy({ _id: 'p3', commissionType: 'percentage', commissionValue: '10', premiumAmount: '1003' }),
      ];
      const result = summarizeReferralLedger(policies, []);
      // 100.1 + 100.2 + 100.3 = 300.6
      expect(result.totalCommission).toBe(300.6);
    });

    it('zero commission policy is valid', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '0' }),
      ];
      const result = summarizeReferralLedger(policies, []);
      expect(result.totalPolicies).toBe(1);
      expect(result.totalCommission).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.balanceDirection).toBe('settled');
    });

    it('only agencyPaid, no commission → referral owes', () => {
      const policies = [
        makePolicy({ commissionType: 'flat', commissionValue: '0', premiumPaidByAgency: '5000' }),
      ];
      const result = summarizeReferralLedger(policies, []);
      expect(result.balance).toBe(-5000);
      expect(result.balanceDirection).toBe('referral_pays');
    });
  });
});

// ── computePolicyStatuses ───────────────────────────────────────────────────────

describe('computePolicyStatuses', () => {
  const sevenPolicies = [
    makePolicy({ _id: 'p1', startDate: '2025-01-01', commissionType: 'flat', commissionValue: '737', premiumPaidByAgency: '0' }),
    makePolicy({ _id: 'p2', startDate: '2025-02-01', commissionType: 'flat', commissionValue: '1291', premiumPaidByAgency: '0' }),
    makePolicy({ _id: 'p3', startDate: '2025-03-01', commissionType: 'flat', commissionValue: '800', premiumPaidByAgency: '0' }),
    makePolicy({ _id: 'p4', startDate: '2025-04-01', commissionType: 'flat', commissionValue: '5932', premiumPaidByAgency: '0' }),
    makePolicy({ _id: 'p5', startDate: '2025-05-01', commissionType: 'flat', commissionValue: '705', premiumPaidByAgency: '4160' }),
    makePolicy({ _id: 'p6', startDate: '2025-06-01', commissionType: 'flat', commissionValue: '913', premiumPaidByAgency: '4308' }),
    makePolicy({ _id: 'p7', startDate: '2025-07-01', commissionType: 'flat', commissionValue: '0', premiumPaidByAgency: '0' }),
  ];

  it('all pending with no payments', () => {
    const statuses = computePolicyStatuses(sevenPolicies, []);
    expect(statuses.every((s) => s.status === 'pending')).toBe(true);
  });

  it('correct statuses after sent 1910', () => {
    // cashSettled = 1910
    // cumulative policyNets: 737, 2028, 2828, 8760, 5305, 1910, 1910
    // (p5 net = 705-4160 = -3455, p6 net = 913-4308 = -3395)
    // p1: cum 737 ≤ 1910 → settled
    // p2: cum 2028 > 1910, prev 737 < 1910 → partial
    // p3: cum 2828 > 1910, prev 2028 > 1910 → pending
    // p4: cum 8760 > 1910, prev 2828 > 1910 → pending
    // p5: cum 5305 > 1910, prev 8760 > 1910 → pending
    // p6: cum 1910 ≤ 1910 → settled
    // p7: cum 1910 ≤ 1910 → settled
    const statuses = computePolicyStatuses(sevenPolicies, [makeSent(1910)]);
    expect(statuses[0].status).toBe('settled');  // p1
    expect(statuses[1].status).toBe('partial');  // p2
    expect(statuses[2].status).toBe('pending');  // p3
    expect(statuses[3].status).toBe('pending');  // p4
    expect(statuses[4].status).toBe('pending');  // p5
    expect(statuses[5].status).toBe('settled');  // p6
    expect(statuses[6].status).toBe('settled');  // p7
  });

  it('exact boundary payment: p1 settled, p2 pending (not partial)', () => {
    // Send 737 → covers exactly p1 (cumulative 737)
    // p1: cum 737 ≤ 737 + 0.005 → settled
    // p2: prevCum 737, cashSettled 737 → 737 < 737 - 0.005 = 736.995 → false → pending
    const statuses = computePolicyStatuses(sevenPolicies, [makeSent(737)]);
    expect(statuses[0].status).toBe('settled');
    expect(statuses[1].status).toBe('pending');
  });

  it('partial within a policy', () => {
    // Send 1000 → p1 cumulative 737 ≤ 1000 → settled
    // p2: prevCumulative 737 < 1000-0.005=999.995 → true → partial
    const statuses = computePolicyStatuses(sevenPolicies, [makeSent(1000)]);
    expect(statuses[0].status).toBe('settled');
    expect(statuses[1].status).toBe('partial');
    expect(statuses[2].status).toBe('pending');
  });

  it('negative policyNet handled correctly', () => {
    // p5: commission 705, agencyPaid 4160 → policyNet = -3455
    const statuses = computePolicyStatuses(sevenPolicies, []);
    const p5 = statuses.find((s) => s._id === 'p5')!;
    expect(p5.policyNet).toBe(-3455);
  });

  it('handles empty inputs', () => {
    const statuses = computePolicyStatuses([], []);
    expect(statuses).toEqual([]);
  });

  it('voided payments are excluded', () => {
    const statuses = computePolicyStatuses(sevenPolicies, [makeSent(1910, true)]);
    // Voided → cashSettled = 0 → all pending
    expect(statuses.every((s) => s.status === 'pending')).toBe(true);
  });

  it('sorts by date then _id', () => {
    const unsorted = [
      makePolicy({ _id: 'b', startDate: '2025-01-01', commissionType: 'flat', commissionValue: '100' }),
      makePolicy({ _id: 'a', startDate: '2025-01-01', commissionType: 'flat', commissionValue: '200' }),
      makePolicy({ _id: 'c', startDate: '2024-12-01', commissionType: 'flat', commissionValue: '50' }),
    ];
    const statuses = computePolicyStatuses(unsorted, []);
    expect(statuses[0]._id).toBe('c'); // earliest date
    expect(statuses[1]._id).toBe('a'); // same date, 'a' < 'b'
    expect(statuses[2]._id).toBe('b');
  });
});
