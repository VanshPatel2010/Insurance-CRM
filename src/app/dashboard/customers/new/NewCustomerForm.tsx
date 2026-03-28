'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveCustomer, updateCustomer, getCustomer, flattenCustomer } from '@/lib/storage';
import { calculateAge } from '@/lib/utils';
import {
  Policy, PolicyType,
  MotorPolicy, MedicalPolicy, FirePolicy, LifePolicy,
  MemberInfo,
} from '@/lib/types';
import { Car, Heart, Flame, Shield, Check, ChevronRight, ChevronLeft, Save, X } from 'lucide-react';

const typeOptions: { type: PolicyType; label: string; desc: string; icon: typeof Car; color: string; bg: string; }[] = [
  { type: 'motor',   label: 'Motor',   desc: 'Vehicle / Auto insurance', icon: Car,    color: '#185FA5', bg: '#e9f2fc' },
  { type: 'medical', label: 'Medical', desc: 'Health & hospitalization',  icon: Heart,  color: '#3B6D11', bg: '#edf7e4' },
  { type: 'fire',    label: 'Fire',    desc: 'Property & fire coverage',  icon: Flame,  color: '#BA7517', bg: '#fef4e0' },
  { type: 'life',    label: 'Life',    desc: 'Life & term insurance',     icon: Shield, color: '#534AB7', bg: '#eeecfb' },
];

type Errors = Record<string, string>;

// ── Field component defined at module level to avoid remounting on re-render ──
function Field({
  label, name, required, error, children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

const emptyBase = () => ({
  customerName: '', phone: '', email: '', address: '',
  policyNumber: '', sumInsured: '', premiumAmount: '',
  startDate: '', endDate: '',
});
const emptyMotor = (): Omit<MotorPolicy, keyof Policy> => ({
  vehicleMake: '', vehicleModel: '', vehicleYear: '', registrationNumber: '',
  engineCC: '', fuelType: '', idvValue: '', ncbPercent: '', addOns: '',
} as unknown as Omit<MotorPolicy, keyof Policy>);
const emptyMedical = () => ({
  dateOfBirth: '', age: '', gender: '' as '' | 'Male' | 'Female' | 'Other', bloodGroup: '',
  preExistingConditions: '', smoker: '' as '' | 'Yes' | 'No', numberOfMembers: '1',
  members: [{ name: '', age: '' }] as MemberInfo[],
  cashlessHospitalNetwork: '',
});
const emptyFire = () => ({
  propertyType: '' as '' | 'Residential' | 'Commercial' | 'Industrial', propertyAddress: '', builtUpArea: '',
  constructionType: '' as '' | 'RCC' | 'Wood' | 'Mixed', propertyValue: '', stockValue: '', riskLocation: '',
});
const emptyLife = () => ({
  dateOfBirth: '', age: '', gender: '' as '' | 'Male' | 'Female' | 'Other', occupation: '',
  annualIncome: '', smoker: '' as '' | 'Yes' | 'No', nomineeName: '', nomineeRelation: '',
  lifePolicyType: '' as '' | 'Term' | 'Endowment' | 'ULIP' | 'Money Back', sumAssured: '', premiumFrequency: '' as '' | 'Monthly' | 'Quarterly' | 'Annual',
  maturityDate: '', policyTerm: '',
});

export default function NewCustomerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [mounted, setMounted] = useState(false);

  const [base, setBase] = useState(emptyBase());
  const [motor, setMotor] = useState(emptyMotor());
  const [medical, setMedical] = useState(emptyMedical());
  const [fire, setFire] = useState(emptyFire());
  const [life, setLife] = useState(emptyLife());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!editId) { setMounted(true); return; }
    getCustomer(editId)
      .then(doc => {
        const p = flattenCustomer(doc);
        setSelectedType(p.type as PolicyType);
        setStep(2);
        setBase({
          customerName: String(p.customerName ?? ''),
          phone:         String(p.phone ?? ''),
          email:         String(p.email ?? ''),
          address:       String(p.address ?? ''),
          policyNumber:  String(p.policyNumber ?? ''),
          sumInsured:    String(p.sumInsured ?? ''),
          premiumAmount: String(p.premiumAmount ?? ''),
          startDate:     String(p.startDate ?? ''),
          endDate:       String(p.endDate ?? ''),
        });
        const d = p.details as Record<string, unknown>;
        if (p.type === 'motor') {
          setMotor({ vehicleMake: String(d.vehicleMake ?? ''), vehicleModel: String(d.vehicleModel ?? ''), vehicleYear: String(d.vehicleYear ?? ''),
            registrationNumber: String(d.registrationNumber ?? ''), engineCC: String(d.engineCC ?? ''), fuelType: String(d.fuelType ?? '') as MotorPolicy['fuelType'],
            idvValue: String(d.idvValue ?? ''), ncbPercent: String(d.ncbPercent ?? ''), addOns: String(d.addOns ?? '') } as unknown as Omit<MotorPolicy, keyof Policy>);
        } else if (p.type === 'medical') {
          setMedical({ dateOfBirth: String(d.dateOfBirth ?? ''), age: String(d.age ?? ''), gender: (d.gender as MedicalPolicy['gender']) ?? '',
            bloodGroup: String(d.bloodGroup ?? ''), preExistingConditions: String(d.preExistingConditions ?? ''), smoker: (d.smoker as MedicalPolicy['smoker']) ?? '',
            numberOfMembers: String(d.numberOfMembers ?? '1'), members: (d.members as MemberInfo[]) ?? [{ name: '', age: '' }],
            cashlessHospitalNetwork: String(d.cashlessHospitalNetwork ?? '') });
        } else if (p.type === 'fire') {
          setFire({ propertyType: (d.propertyType as FirePolicy['propertyType']) ?? '', propertyAddress: String(d.propertyAddress ?? ''), builtUpArea: String(d.builtUpArea ?? ''),
            constructionType: (d.constructionType as FirePolicy['constructionType']) ?? '', propertyValue: String(d.propertyValue ?? ''),
            stockValue: String(d.stockValue ?? ''), riskLocation: String(d.riskLocation ?? '') });
        } else if (p.type === 'life') {
          setLife({ dateOfBirth: String(d.dateOfBirth ?? ''), age: String(d.age ?? ''), gender: (d.gender as LifePolicy['gender']) ?? '', occupation: String(d.occupation ?? ''),
            annualIncome: String(d.annualIncome ?? ''), smoker: (d.smoker as LifePolicy['smoker']) ?? '', nomineeName: String(d.nomineeName ?? ''),
            nomineeRelation: String(d.nomineeRelation ?? ''), lifePolicyType: (d.lifePolicyType as LifePolicy['lifePolicyType']) ?? '', sumAssured: String(d.sumAssured ?? ''),
            premiumFrequency: (d.premiumFrequency as LifePolicy['premiumFrequency']) ?? '', maturityDate: String(d.maturityDate ?? ''), policyTerm: String(d.policyTerm ?? '') });
        }
      })
      .catch(() => router.push('/dashboard/customers'))
      .finally(() => setMounted(true));
  }, [editId]);

  if (!mounted) return null;

  function validate(): Errors {
    const e: Errors = {};
    if (!base.customerName.trim()) e.customerName = 'Required';
    if (!base.phone.match(/^\d{10}$/)) e.phone = 'Enter a valid 10-digit phone number';
    if (base.email && !base.email.includes('@')) e.email = 'Invalid email';
    if (!base.policyNumber.trim()) e.policyNumber = 'Required';
    if (!base.premiumAmount || isNaN(Number(base.premiumAmount))) e.premiumAmount = 'Enter a valid amount';
    if (!base.startDate) e.startDate = 'Required';
    if (!base.endDate) e.endDate = 'Required';
    if (base.startDate && base.endDate && base.endDate <= base.startDate) e.endDate = 'End date must be after start date';
    if (selectedType === 'motor') {
      if (!motor.vehicleMake?.toString().trim()) e.vehicleMake = 'Required';
      if (!motor.vehicleModel?.toString().trim()) e.vehicleModel = 'Required';
      if (!motor.registrationNumber?.toString().trim()) e.registrationNumber = 'Required';
    }
    if (selectedType === 'medical') {
      if (!medical.dateOfBirth) e.dateOfBirth = 'Required';
      if (!medical.gender) e.gender = 'Required';
    }
    if (selectedType === 'fire') {
      if (!fire.propertyType) e.propertyType = 'Required';
      if (!fire.propertyAddress.trim()) e.propertyAddress = 'Required';
    }
    if (selectedType === 'life') {
      if (!life.dateOfBirth) e.dateOfBirth = 'Required';
      if (!life.nomineeName.trim()) e.nomineeName = 'Required';
      if (!life.lifePolicyType) e.lifePolicyType = 'Required';
    }
    return e;
  }



  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    setSubmitError('');

    // Build type-specific details object
    let details: Record<string, unknown> = {};
    if (selectedType === 'motor')   details = { ...motor };
    else if (selectedType === 'medical') details = { ...medical };
    else if (selectedType === 'fire')    details = { ...fire };
    else if (selectedType === 'life')    details = { ...life };

    const payload: Record<string, unknown> = {
      ...base,
      type: selectedType,
      details,
    };

    try {
      if (editId) {
        await updateCustomer(editId, payload);
        router.push(`/dashboard/customers/${editId}`);
      } else {
        const created = await saveCustomer(payload);
        router.push(`/dashboard/customers/${created._id}`);
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  }

  const upBase = (k: keyof typeof base) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setBase(b => ({ ...b, [k]: e.target.value }));
    setErrors(err => { const x = { ...err }; delete x[k]; return x; });
  };

  function syncMembers(count: string) {
    const n = Math.max(1, parseInt(count) || 1);
    setMedical(m => {
      const members = [...m.members];
      while (members.length < n) members.push({ name: '', age: '' });
      while (members.length > n) members.pop();
      return { ...m, numberOfMembers: String(n), members };
    });
  }

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1>{editId ? 'Edit Customer' : 'Add New Customer'}</h1>
            <p>Step 1 of 2 — Select the insurance policy type</p>
          </div>
        </div>
        <div className="steps" style={{ maxWidth: 480, marginBottom: 36 }}>
          <div className="step active"><div className="step-dot">1</div><span className="step-label">Select Type</span></div>
          <div className="step-line" />
          <div className="step"><div className="step-dot">2</div><span className="step-label">Fill Details</span></div>
        </div>
        <div className="type-grid">
          {typeOptions.map(opt => {
            const Icon = opt.icon;
            const isSelected = selectedType === opt.type;
            return (
              <button key={opt.type} className={`type-card ${isSelected ? `selected-${opt.type}` : ''}`}
                onClick={() => setSelectedType(opt.type)} id={`type-${opt.type}`}>
                <div className="type-card-icon" style={{ background: opt.bg, color: opt.color }}><Icon size={26} /></div>
                <div className="type-card-label">{opt.label}</div>
                <div className="type-card-desc">{opt.desc}</div>
                {isSelected && <div style={{ color: opt.color }}><Check size={18} /></div>}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', maxWidth: 640, margin: '32px auto 0' }}>
          <button className="btn btn-ghost" onClick={() => router.push('/dashboard/customers')}><X size={15} /> Cancel</button>
          <button className="btn btn-primary" disabled={!selectedType} onClick={() => selectedType && setStep(2)}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{editId ? 'Edit Customer' : 'Add New Customer'}</h1>
          <p>Step 2 of 2 — Fill in customer &amp; policy details</p>
        </div>
      </div>
      <div className="steps" style={{ maxWidth: 480, marginBottom: 32 }}>
        <div className="step done"><div className="step-dot"><Check size={14} /></div><span className="step-label">Select Type</span></div>
        <div className="step-line done" />
        <div className="step active"><div className="step-dot">2</div><span className="step-label">Fill Details</span></div>
      </div>

      <div className="card">
        <div className="card-body">

          {/* Customer Info */}
          <div className="form-section">
            <div className="form-section-title">👤 Customer Information</div>
            <div className="form-grid">
              <Field label="Customer Name" name="customerName" required error={errors.customerName}>
                <input id="customerName" className={`form-control ${errors.customerName ? 'error' : ''}`}
                  value={base.customerName} onChange={upBase('customerName')} placeholder="Full name" />
              </Field>
              <Field label="Phone Number" name="phone" required error={errors.phone}>
                <input id="phone" className={`form-control ${errors.phone ? 'error' : ''}`}
                  value={base.phone} onChange={upBase('phone')} placeholder="10-digit mobile" maxLength={10} />
              </Field>
              <Field label="Email" name="email" error={errors.email}>
                <input id="email" type="email" className={`form-control ${errors.email ? 'error' : ''}`}
                  value={base.email} onChange={upBase('email')} placeholder="email@example.com" />
              </Field>
              <Field label="Address" name="address">
                <textarea id="address" className="form-control" rows={2}
                  value={base.address} onChange={upBase('address')} placeholder="Full address" />
              </Field>
            </div>
          </div>

          {/* Motor */}
          {selectedType === 'motor' && (
            <div className="form-section">
              <div className="form-section-title" style={{ color: 'var(--motor)' }}>🚗 Vehicle Details</div>
              <div className="form-grid">
                <Field label="Vehicle Make" name="vehicleMake" required error={errors.vehicleMake}>
                  <input id="vehicleMake" className={`form-control ${errors.vehicleMake ? 'error' : ''}`}
                    value={String(motor.vehicleMake ?? '')} onChange={e => setMotor(m => ({ ...m, vehicleMake: e.target.value }))} placeholder="e.g. Maruti Suzuki" />
                </Field>
                <Field label="Vehicle Model" name="vehicleModel" required error={errors.vehicleModel}>
                  <input id="vehicleModel" className={`form-control ${errors.vehicleModel ? 'error' : ''}`}
                    value={String(motor.vehicleModel ?? '')} onChange={e => setMotor(m => ({ ...m, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" />
                </Field>
                <Field label="Vehicle Year" name="vehicleYear">
                  <input id="vehicleYear" className="form-control"
                    value={String(motor.vehicleYear ?? '')} onChange={e => setMotor(m => ({ ...m, vehicleYear: e.target.value }))} placeholder="e.g. 2021" maxLength={4} />
                </Field>
                <Field label="Registration Number" name="registrationNumber" required error={errors.registrationNumber}>
                  <input id="registrationNumber" className={`form-control ${errors.registrationNumber ? 'error' : ''}`}
                    value={String(motor.registrationNumber ?? '')} onChange={e => setMotor(m => ({ ...m, registrationNumber: e.target.value.toUpperCase() }))} placeholder="e.g. MH12AB1234" />
                </Field>
                <Field label="Engine CC" name="engineCC">
                  <input id="engineCC" className="form-control"
                    value={String(motor.engineCC ?? '')} onChange={e => setMotor(m => ({ ...m, engineCC: e.target.value }))} placeholder="e.g. 1200" />
                </Field>
                <Field label="Fuel Type" name="fuelType">
                  <select id="fuelType" className="form-control"
                    value={String(motor.fuelType ?? '')} onChange={e => setMotor(m => ({ ...m, fuelType: e.target.value as typeof motor.fuelType }))}>
                    <option value="">Select</option>
                    <option>Petrol</option><option>Diesel</option><option>CNG</option><option>Electric</option>
                  </select>
                </Field>
                <Field label="IDV Value (₹)" name="idvValue">
                  <input id="idvValue" className="form-control"
                    value={String(motor.idvValue ?? '')} onChange={e => setMotor(m => ({ ...m, idvValue: e.target.value }))} placeholder="Insured Declared Value" />
                </Field>
                <Field label="NCB (%)" name="ncbPercent">
                  <input id="ncbPercent" className="form-control"
                    value={String(motor.ncbPercent ?? '')} onChange={e => setMotor(m => ({ ...m, ncbPercent: e.target.value }))} placeholder="No Claim Bonus %" />
                </Field>
                <Field label="Add-ons" name="addOns">
                  <input id="addOns" className="form-control"
                    value={String(motor.addOns ?? '')} onChange={e => setMotor(m => ({ ...m, addOns: e.target.value }))} placeholder="Zero Dep, Roadside Assistance…" />
                </Field>
              </div>
            </div>
          )}

          {/* Medical */}
          {selectedType === 'medical' && (
            <div className="form-section">
              <div className="form-section-title" style={{ color: 'var(--medical)' }}>🏥 Health Details</div>
              <div className="form-grid">
                <Field label="Date of Birth" name="dateOfBirth" required error={errors.dateOfBirth}>
                  <input id="dateOfBirth" type="date" className={`form-control ${errors.dateOfBirth ? 'error' : ''}`}
                    value={medical.dateOfBirth} onChange={e => { const dob = e.target.value; setMedical(m => ({ ...m, dateOfBirth: dob, age: dob ? String(calculateAge(dob)) : '' })); }} />
                </Field>
                <Field label="Age" name="age">
                  <input id="age" className="form-control" readOnly value={medical.age} placeholder="Auto-calculated" />
                </Field>
                <Field label="Gender" name="gender" required error={errors.gender}>
                  <select id="gender" className={`form-control ${errors.gender ? 'error' : ''}`}
                    value={medical.gender} onChange={e => setMedical(m => ({ ...m, gender: e.target.value as typeof medical.gender }))}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Blood Group" name="bloodGroup">
                  <select id="bloodGroup" className="form-control" value={medical.bloodGroup}
                    onChange={e => setMedical(m => ({ ...m, bloodGroup: e.target.value }))}>
                    <option value="">Select</option>
                    <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                    <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
                  </select>
                </Field>
                <Field label="Smoker" name="smoker">
                  <select id="smoker" className="form-control" value={medical.smoker}
                    onChange={e => setMedical(m => ({ ...m, smoker: e.target.value as typeof medical.smoker }))}>
                    <option value="">Select</option><option>Yes</option><option>No</option>
                  </select>
                </Field>
                <Field label="Pre-existing Conditions" name="preExistingConditions">
                  <input id="preExistingConditions" className="form-control" value={medical.preExistingConditions}
                    onChange={e => setMedical(m => ({ ...m, preExistingConditions: e.target.value }))} placeholder="Diabetes, Hypertension…" />
                </Field>
                <Field label="Cashless Hospital Network" name="cashlessHospitalNetwork">
                  <input id="cashlessHospitalNetwork" className="form-control" value={medical.cashlessHospitalNetwork}
                    onChange={e => setMedical(m => ({ ...m, cashlessHospitalNetwork: e.target.value }))} placeholder="e.g. Apollo, Fortis network" />
                </Field>
                <div className="form-group full-width">
                  <label className="form-label">Number of Members</label>
                  <input type="number" className="form-control" min={1} max={10} value={medical.numberOfMembers}
                    onChange={e => syncMembers(e.target.value)} style={{ maxWidth: 120 }} />
                </div>
                {medical.members.map((mem, i) => (
                  <div key={i} className="member-row" style={{ gridColumn: '1 / -1' }}>
                    <span className="member-row-num">#{i + 1}</span>
                    <input className="form-control" placeholder={`Member ${i+1} name`} value={mem.name}
                      onChange={e => { const updated = [...medical.members]; updated[i] = { ...updated[i], name: e.target.value }; setMedical(x => ({ ...x, members: updated })); }} />
                    <input className="form-control" placeholder="Age" maxLength={3} style={{ maxWidth: 80 }} value={mem.age}
                      onChange={e => { const updated = [...medical.members]; updated[i] = { ...updated[i], age: e.target.value }; setMedical(x => ({ ...x, members: updated })); }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fire */}
          {selectedType === 'fire' && (
            <div className="form-section">
              <div className="form-section-title" style={{ color: 'var(--fire)' }}>🏠 Property Details</div>
              <div className="form-grid">
                <Field label="Property Type" name="propertyType" required error={errors.propertyType}>
                  <select id="propertyType" className={`form-control ${errors.propertyType ? 'error' : ''}`}
                    value={fire.propertyType} onChange={e => setFire(f => ({ ...f, propertyType: e.target.value as typeof fire.propertyType }))}>
                    <option value="">Select</option><option>Residential</option><option>Commercial</option><option>Industrial</option>
                  </select>
                </Field>
                <Field label="Construction Type" name="constructionType">
                  <select id="constructionType" className="form-control" value={fire.constructionType}
                    onChange={e => setFire(f => ({ ...f, constructionType: e.target.value as typeof fire.constructionType }))}>
                    <option value="">Select</option><option>RCC</option><option>Wood</option><option>Mixed</option>
                  </select>
                </Field>
                <Field label="Built-up Area (sq ft)" name="builtUpArea">
                  <input id="builtUpArea" className="form-control" value={fire.builtUpArea}
                    onChange={e => setFire(f => ({ ...f, builtUpArea: e.target.value }))} placeholder="e.g. 1200" />
                </Field>
                <Field label="Property Value (₹)" name="propertyValue">
                  <input id="propertyValue" className="form-control" value={fire.propertyValue}
                    onChange={e => setFire(f => ({ ...f, propertyValue: e.target.value }))} placeholder="Market value" />
                </Field>
                <Field label="Stock Value (₹)" name="stockValue">
                  <input id="stockValue" className="form-control" value={fire.stockValue}
                    onChange={e => setFire(f => ({ ...f, stockValue: e.target.value }))} placeholder="If commercial" />
                </Field>
                <Field label="Property Address" name="propertyAddress" required error={errors.propertyAddress}>
                  <textarea id="propertyAddress" className={`form-control ${errors.propertyAddress ? 'error' : ''}`} rows={2}
                    value={fire.propertyAddress} onChange={e => setFire(f => ({ ...f, propertyAddress: e.target.value }))} placeholder="Full property address" />
                </Field>
                <Field label="Risk Location" name="riskLocation">
                  <input id="riskLocation" className="form-control" value={fire.riskLocation}
                    onChange={e => setFire(f => ({ ...f, riskLocation: e.target.value }))} placeholder="City / Zone" />
                </Field>
              </div>
            </div>
          )}

          {/* Life */}
          {selectedType === 'life' && (
            <div className="form-section">
              <div className="form-section-title" style={{ color: 'var(--life)' }}>💼 Life Policy Details</div>
              <div className="form-grid">
                <Field label="Date of Birth" name="dateOfBirth" required error={errors.dateOfBirth}>
                  <input id="dateOfBirth" type="date" className={`form-control ${errors.dateOfBirth ? 'error' : ''}`}
                    value={life.dateOfBirth} onChange={e => { const dob = e.target.value; setLife(l => ({ ...l, dateOfBirth: dob, age: dob ? String(calculateAge(dob)) : '' })); }} />
                </Field>
                <Field label="Age" name="age">
                  <input id="age" className="form-control" readOnly value={life.age} placeholder="Auto-calculated" />
                </Field>
                <Field label="Gender" name="gender">
                  <select id="gender" className="form-control" value={life.gender}
                    onChange={e => setLife(l => ({ ...l, gender: e.target.value as typeof life.gender }))}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Occupation" name="occupation">
                  <input id="occupation" className="form-control" value={life.occupation}
                    onChange={e => setLife(l => ({ ...l, occupation: e.target.value }))} placeholder="e.g. Engineer" />
                </Field>
                <Field label="Annual Income (₹)" name="annualIncome">
                  <input id="annualIncome" className="form-control" value={life.annualIncome}
                    onChange={e => setLife(l => ({ ...l, annualIncome: e.target.value }))} placeholder="Annual income" />
                </Field>
                <Field label="Smoker" name="smoker">
                  <select id="smoker" className="form-control" value={life.smoker}
                    onChange={e => setLife(l => ({ ...l, smoker: e.target.value as typeof life.smoker }))}>
                    <option value="">Select</option><option>Yes</option><option>No</option>
                  </select>
                </Field>
                <Field label="Nominee Name" name="nomineeName" required error={errors.nomineeName}>
                  <input id="nomineeName" className={`form-control ${errors.nomineeName ? 'error' : ''}`}
                    value={life.nomineeName} onChange={e => setLife(l => ({ ...l, nomineeName: e.target.value }))} placeholder="Nominee full name" />
                </Field>
                <Field label="Nominee Relation" name="nomineeRelation">
                  <input id="nomineeRelation" className="form-control" value={life.nomineeRelation}
                    onChange={e => setLife(l => ({ ...l, nomineeRelation: e.target.value }))} placeholder="e.g. Spouse, Child" />
                </Field>
                <Field label="Policy Type" name="lifePolicyType" required error={errors.lifePolicyType}>
                  <select id="lifePolicyType" className={`form-control ${errors.lifePolicyType ? 'error' : ''}`}
                    value={life.lifePolicyType} onChange={e => setLife(l => ({ ...l, lifePolicyType: e.target.value as typeof life.lifePolicyType }))}>
                    <option value="">Select</option>
                    <option>Term</option><option>Endowment</option><option>ULIP</option><option>Money Back</option>
                  </select>
                </Field>
                <Field label="Sum Assured (₹)" name="sumAssured">
                  <input id="sumAssured" className="form-control" value={life.sumAssured}
                    onChange={e => setLife(l => ({ ...l, sumAssured: e.target.value }))} placeholder="Sum assured" />
                </Field>
                <Field label="Premium Frequency" name="premiumFrequency">
                  <select id="premiumFrequency" className="form-control" value={life.premiumFrequency}
                    onChange={e => setLife(l => ({ ...l, premiumFrequency: e.target.value as typeof life.premiumFrequency }))}>
                    <option value="">Select</option>
                    <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                  </select>
                </Field>
                <Field label="Policy Term (Years)" name="policyTerm">
                  <input id="policyTerm" className="form-control" value={life.policyTerm}
                    onChange={e => setLife(l => ({ ...l, policyTerm: e.target.value }))} placeholder="e.g. 20" />
                </Field>
                <Field label="Maturity Date" name="maturityDate">
                  <input id="maturityDate" type="date" className="form-control" value={life.maturityDate}
                    onChange={e => setLife(l => ({ ...l, maturityDate: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}

          {/* Policy Info */}
          <div className="form-section">
            <div className="form-section-title">📋 Policy Information</div>
            <div className="form-grid">
              <Field label="Policy Number" name="policyNumber" required error={errors.policyNumber}>
                <input id="policyNumber" className={`form-control ${errors.policyNumber ? 'error' : ''}`}
                  value={base.policyNumber} onChange={upBase('policyNumber')} placeholder="Policy/Certificate number" />
              </Field>
              <Field label="Sum Insured (₹)" name="sumInsured">
                <input id="sumInsured" className="form-control"
                  value={base.sumInsured} onChange={upBase('sumInsured')} placeholder="Total sum insured" />
              </Field>
              <Field label="Premium Amount (₹)" name="premiumAmount" required error={errors.premiumAmount}>
                <input id="premiumAmount" className={`form-control ${errors.premiumAmount ? 'error' : ''}`}
                  value={base.premiumAmount} onChange={upBase('premiumAmount')} placeholder="Annual premium" />
              </Field>
              <Field label="Policy Start Date" name="startDate" required error={errors.startDate}>
                <input id="startDate" type="date" className={`form-control ${errors.startDate ? 'error' : ''}`}
                  value={base.startDate} onChange={upBase('startDate')} />
              </Field>
              <Field label="Policy End Date" name="endDate" required error={errors.endDate}>
                <input id="endDate" type="date" className={`form-control ${errors.endDate ? 'error' : ''}`}
                  value={base.endDate} onChange={upBase('endDate')} />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            {!editId && (
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => router.push('/dashboard/customers')} disabled={submitting}>
              <X size={15} /> Cancel
            </button>
            {submitError && (
              <span style={{ color: 'var(--status-expired)', fontSize: 13, alignSelf: 'center' }}>
                {submitError}
              </span>
            )}
            <button className="btn btn-primary" onClick={handleSubmit} id="save-customer" disabled={submitting}>
              <Save size={15} /> {submitting ? (editId ? 'Saving…' : 'Saving…') : (editId ? 'Save Changes' : 'Save Customer')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
