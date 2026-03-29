'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveCustomer, updateCustomer, getCustomer, flattenCustomer } from '@/lib/storage';
import { calculateAge } from '@/lib/utils';
import {
  Policy, PolicyType,
  MotorPolicy, MedicalPolicy, FirePolicy, LifePolicy,
  MemberInfo,
} from '@/lib/types';
import { Car, Heart, Flame, Shield, Check, ChevronRight, ChevronLeft, Save, X, Upload, FileText, Loader2, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { pdfQueue, QueueItem } from '@/lib/pdfQueue';
import { formatFileSize, estimateQueueTime } from '@/lib/formatFileSize';

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

  // ── PDF Upload mode ─────────────────────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<'manual' | 'pdf'>('manual');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [wasExtracted, setWasExtracted] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

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

  // ── Queue subscription — must be before early return to respect Rules of Hooks ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const unsub = pdfQueue.subscribe(setQueueItems);
    setQueueItems(pdfQueue.getQueue());
    return unsub;
  }, []);

  // Watch for a completed extraction to auto-fill the form
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!selectedResultId) return;
    const done = queueItems.find(
      (item) => item.id === selectedResultId && item.status === 'done' && item.result
    );
    if (done?.result) {
      autoFillForm(done.result);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueItems, selectedResultId]);

  if (!mounted) return null;

  function autoFillForm(data: Record<string, unknown>) {
    if (!data) return;
    const d = (data.details ?? {}) as Record<string, unknown>;
    const type = data.type as PolicyType | undefined;

    if (type && ['motor', 'medical', 'fire', 'life'].includes(type)) {
      setSelectedType(type);
    }

    setBase({
      customerName:  String(data.customerName  ?? ''),
      phone:         String(data.phone          ?? ''),
      email:         String(data.email          ?? ''),
      address:       String(data.address        ?? ''),
      policyNumber:  String(data.policyNumber   ?? ''),
      sumInsured:    data.sumInsured  != null ? String(data.sumInsured)  : '',
      premiumAmount: data.premium     != null ? String(data.premium)     : '',
      startDate:     String(data.startDate      ?? ''),
      endDate:       String(data.endDate        ?? ''),
    });

    if (type === 'motor') {
      setMotor({
        vehicleMake:        String(d.make         ?? ''),
        vehicleModel:       String(d.model        ?? ''),
        vehicleYear:        d.year   != null ? String(d.year)   : '',
        registrationNumber: String(d.vehicleReg   ?? ''),
        engineCC:           d.engineCC != null ? String(d.engineCC) : '',
        fuelType:           String(d.fuelType ?? '') as MotorPolicy['fuelType'],
        idvValue:           d.idvValue != null ? String(d.idvValue) : '',
        ncbPercent:         d.ncb      != null ? String(d.ncb)      : '',
        addOns:             Array.isArray(d.addOns) ? (d.addOns as string[]).join(', ') : String(d.addOns ?? ''),
      } as unknown as Omit<MotorPolicy, keyof Policy>);
    } else if (type === 'medical') {
      const dob = String(d.dateOfBirth ?? '');
      const memberNames = Array.isArray(d.memberNames) ? d.memberNames as string[] : [];
      const count = d.membersCount != null ? Number(d.membersCount) : Math.max(1, memberNames.length);
      const members: MemberInfo[] = Array.from({ length: count }, (_, i) => ({
        name: memberNames[i] ?? '',
        age: '',
      }));
      setMedical({
        dateOfBirth: dob,
        age: dob ? String(calculateAge(dob)) : (d.age != null ? String(d.age) : ''),
        gender: String(d.gender ?? '') as MedicalPolicy['gender'],
        bloodGroup: String(d.bloodGroup ?? ''),
        preExistingConditions: String(d.preExistingConditions ?? ''),
        smoker: d.smoker === true ? 'Yes' : d.smoker === false ? 'No' : '' as MedicalPolicy['smoker'],
        numberOfMembers: String(count),
        members,
        cashlessHospitalNetwork: String(d.cashlessNetwork ?? ''),
      });
    } else if (type === 'fire') {
      setFire({
        propertyType: String(d.propertyType ?? '') as FirePolicy['propertyType'],
        propertyAddress: String(d.propertyAddress ?? ''),
        builtUpArea: d.builtUpArea != null ? String(d.builtUpArea) : '',
        constructionType: String(d.constructionType ?? '') as FirePolicy['constructionType'],
        propertyValue: d.propertyValue != null ? String(d.propertyValue) : '',
        stockValue: d.stockValue != null ? String(d.stockValue) : '',
        riskLocation: String(d.riskLocation ?? ''),
      });
    } else if (type === 'life') {
      const dob = String(d.dateOfBirth ?? '');
      setLife({
        dateOfBirth: dob,
        age: dob ? String(calculateAge(dob)) : (d.age != null ? String(d.age) : ''),
        gender: String(d.gender ?? '') as LifePolicy['gender'],
        occupation: String(d.occupation ?? ''),
        annualIncome: d.annualIncome != null ? String(d.annualIncome) : '',
        smoker: d.smoker === true ? 'Yes' : d.smoker === false ? 'No' : '' as LifePolicy['smoker'],
        nomineeName: String(d.nomineeName ?? ''),
        nomineeRelation: String(d.nomineeRelation ?? ''),
        lifePolicyType: String(d.policyType ?? '') as LifePolicy['lifePolicyType'],
        sumAssured: data.sumInsured != null ? String(data.sumInsured) : '',
        premiumFrequency: String(d.premiumFrequency ?? '') as LifePolicy['premiumFrequency'],
        maturityDate: String(d.maturityDate ?? ''),
        policyTerm: d.policyTerm != null ? String(d.policyTerm) : '',
      });
    }

    setWasExtracted(true);
    setExtractionConfidence(typeof data.confidence === 'number' ? data.confidence : 100);
    setErrors({});
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const validFiles: File[] = [];
    const errs: string[] = [];
    Array.from(files).forEach((file) => {
      if (file.type !== 'application/pdf') {
        errs.push(`${file.name} is not a PDF`);
      } else if (file.size > 10 * 1024 * 1024) {
        errs.push(`${file.name} exceeds 10 MB limit`);
      } else {
        validFiles.push(file);
      }
    });
    setFileErrors(errs);
    if (validFiles.length > 0) {
      const ids = pdfQueue.addFiles(validFiles);
      setSelectedResultId(ids[0]);
    }
  }

  function handleModeSwitch(mode: 'manual' | 'pdf') {
    if (mode === entryMode) return;
    const hasData = Object.values(base).some((v) => v !== '') ||
      wasExtracted;
    if (hasData) {
      const msg = mode === 'pdf'
        ? 'Switching to PDF mode will clear your entered data. Continue?'
        : 'Switching to manual mode will clear extracted data. Continue?';
      if (!window.confirm(msg)) return;
    }
    // Reset form state
    setBase(emptyBase());
    setMotor(emptyMotor());
    setMedical(emptyMedical());
    setFire(emptyFire());
    setLife(emptyLife());
    setErrors({});
    setWasExtracted(false);
    setExtractionConfidence(100);
    setFileErrors([]);
    if (mode === 'manual') {
      pdfQueue.clearCompleted();
      setSelectedResultId(null);
    }
    setEntryMode(mode);
  }


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
        // Clean up the used queue item and prompt if more are waiting
        if (selectedResultId) {
          pdfQueue.removeItem(selectedResultId);
          setSelectedResultId(null);
          const remaining = pdfQueue.getQueue().filter(
            (i) => i.status === 'done' || i.status === 'waiting' || i.status === 'processing' || i.status === 'retrying'
          );
          if (remaining.length > 0) {
            const next = remaining.find((i) => i.status === 'done');
            const msg = next
              ? `Customer saved! Load next PDF from queue?`
              : `Customer saved! ${remaining.length} PDF(s) still processing — come back to use them.`;
            if (next && window.confirm(msg)) {
              setSelectedResultId(next.id);
              if (next.result) autoFillForm(next.result);
              setSubmitting(false);
              return;
            }
          }
        }
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

          {/* ── Mode Toggle ─────────────────────────────────────────── */}
          {!editId && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <button
                id="mode-manual"
                onClick={() => handleModeSwitch('manual')}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 13.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: 'none', cursor: 'pointer', transition: 'all .15s ease',
                  background: entryMode === 'manual' ? 'var(--primary)' : 'var(--surface)',
                  color: entryMode === 'manual' ? '#fff' : 'var(--text-muted)',
                }}
              >
                ✎ Enter Manually
              </button>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <button
                id="mode-pdf"
                onClick={() => handleModeSwitch('pdf')}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 13.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: 'none', cursor: 'pointer', transition: 'all .15s ease',
                  background: entryMode === 'pdf' ? 'var(--primary)' : 'var(--surface)',
                  color: entryMode === 'pdf' ? '#fff' : 'var(--text-muted)',
                }}
              >
                <Upload size={15} /> Upload Policy PDF
              </button>
            </div>
          )}

          {/* ── PDF Drop Zone ────────────────────────────────────────── */}
          {entryMode === 'pdf' && (
            <div style={{ marginBottom: 20 }}>
              <div
                id="pdf-drop-zone"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'var(--primary-light)' : 'var(--bg)',
                  transition: 'all .15s ease',
                  marginBottom: 12,
                }}
              >
                <Upload size={28} style={{ color: 'var(--primary)', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                  Drop PDF files here or click to browse
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Supports multiple files &nbsp;•&nbsp; Max 10 MB each
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              {fileErrors.length > 0 && (
                <div style={{ background: 'var(--status-expired-bg)', border: '1px solid #f7b8b8', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12.5, color: 'var(--status-expired)', marginBottom: 8 }}>
                  {fileErrors.map((err, i) => <div key={i}>⚠ {err}</div>)}
                </div>
              )}

              {/* ── Queue List ─────────────────────────────────────── */}
              {queueItems.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {/* Estimated time */}
                  {(() => {
                    const waiting = queueItems.filter(i => i.status === 'waiting' || i.status === 'retrying');
                    const done    = queueItems.filter(i => i.status === 'done').length;
                    const total   = queueItems.length;
                    return (
                      <div style={{ padding: '10px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Processed: <strong>{done}</strong> of <strong>{total}</strong>
                          {waiting.length > 0 && (
                            <> &nbsp;•&nbsp; ⏱ {estimateQueueTime(waiting.length)} remaining</>
                          )}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => pdfQueue.clearCompleted()}>
                          Clear Completed
                        </button>
                      </div>
                    );
                  })()}

                  {/* Progress bar */}
                  {(() => {
                    const done  = queueItems.filter(i => i.status === 'done' || i.status === 'error').length;
                    const total = queueItems.length;
                    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div style={{ height: 4, background: 'var(--border)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', transition: 'width .4s ease' }} />
                      </div>
                    );
                  })()}

                  {/* Items */}
                  {queueItems.map((item) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid var(--border-light)',
                      background: item.id === selectedResultId ? 'var(--primary-light)' : 'var(--surface)',
                    }}>
                      <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.fileName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatFileSize(item.fileSize)}</div>
                      </div>

                      {/* Status indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
                        {item.status === 'waiting'    && <span style={{ color: 'var(--text-muted)' }}>⬤ Waiting…</span>}
                        {item.status === 'processing' && <><Loader2 size={13} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} /> <span style={{ color: 'var(--primary)' }}>Extracting…</span></>}
                        {item.status === 'retrying'   && <span style={{ color: 'var(--status-expiring)' }}>⟳ Retrying ({item.retries}/3)…</span>}
                        {item.status === 'done'       && <><CheckCircle2 size={14} style={{ color: 'var(--status-active)' }} /><span style={{ color: 'var(--status-active)' }}>Done</span></>}
                        {item.status === 'error'      && (
                          <span style={{ color: 'var(--status-expired)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={13} /> {item.error}
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
                              onClick={() => pdfQueue.retryItem(item.id)}>Retry</button>
                          </span>
                        )}
                      </div>

                      {/* Use button */}
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={item.status !== 'done'}
                        onClick={() => {
                          setSelectedResultId(item.id);
                          if (item.result) autoFillForm(item.result);
                        }}
                      >
                        Use
                      </button>

                      {/* Remove button */}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={item.status === 'processing'}
                        onClick={() => {
                          pdfQueue.removeItem(item.id);
                          if (item.id === selectedResultId) setSelectedResultId(null);
                        }}
                        style={{ padding: '4px 8px' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Extraction Banner ──────────────────────────────────── */}
          {wasExtracted && (
            <div style={{
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13.5,
              fontWeight: 500,
              background: extractionConfidence >= 80 ? '#e4f5ec' : extractionConfidence >= 60 ? 'var(--status-expiring-bg)' : 'var(--status-expiring-bg)',
              border: `1px solid ${extractionConfidence >= 80 ? '#a7e3be' : extractionConfidence >= 60 ? 'var(--fire-border)' : '#f7b8b8'}`,
              color: extractionConfidence >= 80 ? 'var(--status-active)' : 'var(--status-expiring)',
            }}>
              {extractionConfidence >= 80
                ? <CheckCircle2 size={16} />
                : extractionConfidence >= 60
                  ? <AlertTriangle size={16} />
                  : <AlertCircle size={16} />}
              {extractionConfidence >= 80 && 'Details extracted from PDF — review before saving'}
              {extractionConfidence >= 60 && extractionConfidence < 80 && 'Low confidence extraction — verify all fields carefully'}
              {extractionConfidence < 60  && 'Very low confidence — please verify everything. Policy type may be incorrect.'}
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>Confidence: {extractionConfidence}%</span>
            </div>
          )}

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
