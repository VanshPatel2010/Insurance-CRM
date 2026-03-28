// ─── Shared base fields for all policy types ─────────────────────────────────

export type PolicyType = 'motor' | 'medical' | 'fire' | 'life';
export type PolicyStatus = 'Active' | 'Expired' | 'Expiring Soon';
export type FuelType = 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
export type Gender = 'Male' | 'Female' | 'Other';
export type PropertyType = 'Residential' | 'Commercial' | 'Industrial';
export type ConstructionType = 'RCC' | 'Wood' | 'Mixed';
export type LifePolicyType = 'Term' | 'Endowment' | 'ULIP' | 'Money Back';
export type PremiumFrequency = 'Monthly' | 'Quarterly' | 'Annual';

export interface BasePolicy {
  id: string;
  type: PolicyType;
  createdAt: string;
  updatedAt: string;
  // Customer Info
  customerName: string;
  phone: string;
  email: string;
  address: string;
  // Policy Info
  policyNumber: string;
  sumInsured: string;
  premiumAmount: string;
  startDate: string;
  endDate: string;
}

// ─── Motor Insurance ──────────────────────────────────────────────────────────

export interface MotorPolicy extends BasePolicy {
  type: 'motor';
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registrationNumber: string;
  engineCC: string;
  fuelType: FuelType | '';
  idvValue: string;
  ncbPercent: string;
  addOns: string; // comma-separated
}

// ─── Medical / Health Insurance ──────────────────────────────────────────────

export interface MemberInfo {
  name: string;
  age: string;
}

export interface MedicalPolicy extends BasePolicy {
  type: 'medical';
  dateOfBirth: string;
  age: string;
  gender: Gender | '';
  bloodGroup: string;
  preExistingConditions: string;
  smoker: 'Yes' | 'No' | '';
  numberOfMembers: string;
  members: MemberInfo[];
  cashlessHospitalNetwork: string;
}

// ─── Fire / Property Insurance ───────────────────────────────────────────────

export interface FirePolicy extends BasePolicy {
  type: 'fire';
  propertyType: PropertyType | '';
  propertyAddress: string;
  builtUpArea: string;
  constructionType: ConstructionType | '';
  propertyValue: string;
  stockValue: string;
  riskLocation: string;
}

// ─── Life Insurance ───────────────────────────────────────────────────────────

export interface LifePolicy extends BasePolicy {
  type: 'life';
  dateOfBirth: string;
  age: string;
  gender: Gender | '';
  occupation: string;
  annualIncome: string;
  smoker: 'Yes' | 'No' | '';
  nomineeName: string;
  nomineeRelation: string;
  lifePolicyType: LifePolicyType | '';
  sumAssured: string;
  premiumFrequency: PremiumFrequency | '';
  maturityDate: string;
  policyTerm: string;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type Policy = MotorPolicy | MedicalPolicy | FirePolicy | LifePolicy;
