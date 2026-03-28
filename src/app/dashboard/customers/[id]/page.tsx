'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getCustomer, deleteCustomer, flattenCustomer } from '@/lib/storage';
import { getStatus, formatCurrency, formatDate, daysUntilExpiry } from '@/lib/utils';
import { PolicyType } from '@/lib/types';
import PolicyBadge from '@/components/PolicyBadge';
import StatusBadge from '@/components/StatusBadge';
import {
  Pencil,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
} from 'lucide-react';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-field">
      <div className="detail-field-label">{label}</div>
      <div className="detail-field-value">{value || '—'}</div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [policy, setPolicy] = useState<Record<string, any> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    getCustomer(id)
      .then(doc => setPolicy(flattenCustomer(doc)))
      .catch(() => router.push('/dashboard/customers'))
      .finally(() => setMounted(true));
  }, [id, router]);

  if (!mounted || !policy) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  const status = getStatus(policy.endDate as string);
  const days   = daysUntilExpiry(policy.endDate as string);
  const type   = policy.type as PolicyType;

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteCustomer(id);
      router.push('/dashboard/customers');
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/dashboard/customers" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} /> Back
          </Link>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {policy.customerName}
              <PolicyBadge type={type} />
              <StatusBadge status={status} />
            </h1>
            <p>Policy #{policy.policyNumber}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/dashboard/customers/new?id=${id}`} className="btn btn-outline">
            <Pencil size={14} /> Edit
          </Link>
          <button className="btn btn-danger" onClick={() => setDeleteConfirm(true)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Renewal Alert */}
      {status === 'Expiring Soon' && (
        <div className="alert alert-warning">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Renewal Alert:</strong> This policy expires in {days} day{days !== 1 ? 's' : ''} on {formatDate(policy.endDate)}.
            Please contact the customer for timely renewal.
          </div>
        </div>
      )}
      {status === 'Expired' && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Policy Expired:</strong> This policy expired on {formatDate(policy.endDate)}. Customer is currently uninsured.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Customer Info Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">👤 Customer Information</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="Full Name" value={policy.customerName} />
              <div className="detail-field">
                <div className="detail-field-label">Phone</div>
                <div className="detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={13} style={{ color: 'var(--primary)' }} /> {policy.phone}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Email</div>
                <div className="detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={13} style={{ color: 'var(--primary)' }} /> {policy.email || '—'}
                </div>
              </div>
              <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-field-label">Address</div>
                <div className="detail-field-value" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MapPin size={13} style={{ color: 'var(--primary)', marginTop: 3 }} /> {policy.address || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Type-specific Card */}
        {policy.type === 'motor' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--motor)' }}>🚗 Vehicle Details</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <Field label="Vehicle Make" value={policy.vehicleMake} />
                <Field label="Vehicle Model" value={policy.vehicleModel} />
                <Field label="Vehicle Year" value={policy.vehicleYear} />
                <Field label="Registration Number" value={policy.registrationNumber} />
                <Field label="Engine CC" value={policy.engineCC} />
                <Field label="Fuel Type" value={policy.fuelType} />
                <Field label="IDV Value" value={formatCurrency(policy.idvValue)} />
                <Field label="NCB %" value={policy.ncbPercent ? `${policy.ncbPercent}%` : '—'} />
                <Field label="Add-ons" value={policy.addOns} />
              </div>
            </div>
          </div>
        )}

        {policy.type === 'medical' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--medical)' }}>🏥 Health Details</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <Field label="Date of Birth" value={formatDate(policy.dateOfBirth)} />
                <Field label="Age" value={policy.age} />
                <Field label="Gender" value={policy.gender} />
                <Field label="Blood Group" value={policy.bloodGroup} />
                <Field label="Smoker" value={policy.smoker} />
                <Field label="Pre-existing Conditions" value={policy.preExistingConditions || 'None'} />
                <Field label="Members Covered" value={policy.numberOfMembers} />
                <Field label="Cashless Network" value={policy.cashlessHospitalNetwork} />
              </div>
              {Array.isArray(policy.members) && policy.members.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="form-section-title" style={{ fontSize: 12, marginBottom: 10 }}>Members</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {policy.members.map((m: { name?: string; age?: string }, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13.5 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)', minWidth: 28 }}>#{i + 1}</span>
                        <span style={{ fontWeight: 600 }}>{m.name || '—'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Age: {m.age || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {policy.type === 'fire' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--fire)' }}>🏠 Property Details</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <Field label="Property Type" value={policy.propertyType} />
                <Field label="Construction Type" value={policy.constructionType} />
                <Field label="Built-up Area" value={`${policy.builtUpArea} sq ft`} />
                <Field label="Property Value" value={formatCurrency(policy.propertyValue)} />
                <Field label="Stock Value" value={formatCurrency(policy.stockValue)} />
                <Field label="Risk Location" value={policy.riskLocation} />
                <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-field-label">Property Address</div>
                  <div className="detail-field-value">{policy.propertyAddress || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {policy.type === 'life' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--life)' }}>💼 Life Policy Details</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <Field label="Date of Birth" value={formatDate(policy.dateOfBirth)} />
                <Field label="Age" value={policy.age} />
                <Field label="Gender" value={policy.gender} />
                <Field label="Occupation" value={policy.occupation} />
                <Field label="Annual Income" value={formatCurrency(policy.annualIncome)} />
                <Field label="Smoker" value={policy.smoker} />
                <Field label="Nominee Name" value={policy.nomineeName} />
                <Field label="Nominee Relation" value={policy.nomineeRelation} />
                <Field label="Policy Type" value={policy.lifePolicyType} />
                <Field label="Sum Assured" value={formatCurrency(policy.sumAssured)} />
                <Field label="Premium Frequency" value={policy.premiumFrequency} />
                <Field label="Policy Term" value={`${policy.policyTerm} years`} />
                <Field label="Maturity Date" value={formatDate(policy.maturityDate)} />
              </div>
            </div>
          </div>
        )}

        {/* Policy Info Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <FileText size={15} style={{ color: 'var(--primary)' }} /> Policy Information
            </span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="Policy Number" value={policy.policyNumber} />
              <Field label="Sum Insured" value={formatCurrency(policy.sumInsured)} />
              <Field label="Premium Amount" value={formatCurrency(policy.premiumAmount)} />
              <div className="detail-field">
                <div className="detail-field-label">Start Date</div>
                <div className="detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} style={{ color: 'var(--primary)' }} /> {formatDate(policy.startDate)}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">End Date</div>
                <div className="detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 6, color: status === 'Expired' ? 'var(--status-expired)' : status === 'Expiring Soon' ? 'var(--status-expiring)' : 'inherit' }}>
                  <Calendar size={13} /> {formatDate(policy.endDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          Added on {formatDate(policy.createdAt)} · Last updated {formatDate(policy.updatedAt)}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="confirm-overlay" onClick={() => !deleteLoading && setDeleteConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete {policy.customerName}?</h3>
            <p>
              This will permanently remove this customer and all policy data. This action cannot be undone.
            </p>
            {deleteError && <p style={{ color: 'var(--status-expired)', fontSize: 13 }}>{deleteError}</p>}
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)} disabled={deleteLoading}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--status-expired)' }} onClick={handleDelete} disabled={deleteLoading}>
                <Trash2 size={14} /> {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
