import { differenceInDays, parseISO, isValid } from 'date-fns';
import { Policy, PolicyStatus } from './types';

export function getStatus(endDate: string): PolicyStatus {
  if (!endDate) return 'Active';
  try {
    const end = parseISO(endDate);
    if (!isValid(end)) return 'Active';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = differenceInDays(end, today);
    if (diff < 0) return 'Expired';
    if (diff <= 30) return 'Expiring Soon';
    return 'Active';
  } catch {
    return 'Active';
  }
}

export function getExpiringPolicies(policies: Policy[]): Policy[] {
  return policies.filter(p => {
    const status = getStatus(p.endDate);
    return status === 'Expiring Soon';
  });
}

export function getTotalPremium(policies: Policy[]): number {
  return policies.reduce((sum, p) => {
    const val = parseFloat(p.premiumAmount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function calculateAge(dob: string): number {
  if (!dob) return 0;
  try {
    const birth = parseISO(dob);
    if (!isValid(birth)) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return 0;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function daysUntilExpiry(endDate: string): number {
  if (!endDate) return Infinity;
  try {
    const end = parseISO(endDate);
    if (!isValid(end)) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(end, today);
  } catch {
    return Infinity;
  }
}
