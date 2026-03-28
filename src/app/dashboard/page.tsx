'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboardStats, DashboardStats } from '@/lib/storage';
import { formatCurrency, formatDate, daysUntilExpiry } from '@/lib/utils';
import { PolicyType } from '@/lib/types';
import PolicyBadge from '@/components/PolicyBadge';
import StatusBadge from '@/components/StatusBadge';
import {
  Users,
  Car,
  Heart,
  Flame,
  Shield,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
} from 'lucide-react';

const typeConfig: Record<
  PolicyType,
  { label: string; icon: typeof Car; color: string; bg: string; badgeClass: string }
> = {
  motor:   { label: 'Motor',   icon: Car,    color: '#185FA5', bg: '#e9f2fc', badgeClass: 'motor' },
  medical: { label: 'Medical', icon: Heart,  color: '#3B6D11', bg: '#edf7e4', badgeClass: 'medical' },
  fire:    { label: 'Fire',    icon: Flame,  color: '#BA7517', bg: '#fef4e0', badgeClass: 'fire' },
  life:    { label: 'Life',    icon: Shield, color: '#534AB7', bg: '#eeecfb', badgeClass: 'life' },
};

export default function DashboardPage() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading dashboard…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--status-expired)' }}>
        {error || 'Failed to load dashboard.'}
      </div>
    );
  }

  const { total, typeCounts, expiring, totalPremium, recent } = stats;

  return (
    <div>
      {/* ── Hero Stat ── */}
      <div className="stat-grid">
        {/* Total Customers */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Users size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              All Types
            </span>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--primary)' }}>{total}</div>
          <div className="stat-card-label">Total Customers</div>
        </div>

        {/* Per-type cards */}
        {(Object.keys(typeConfig) as PolicyType[]).map(type => {
          const cfg  = typeConfig[type];
          const Icon = cfg.icon;
          return (
            <div
              key={type}
              className="stat-card"
              style={{ borderLeft: `4px solid ${cfg.color}` }}
            >
              <div className="stat-card-header">
                <div className="stat-card-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={20} />
                </div>
                <span className="stat-card-badge" style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
              <div className="stat-card-value" style={{ color: cfg.color }}>{typeCounts[type] ?? 0}</div>
              <div className="stat-card-label">{cfg.label} Policies</div>
            </div>
          );
        })}

        {/* Total Premium */}
        <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: '#d1fae5', color: '#059669' }}>
              <TrendingUp size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: '#d1fae5', color: '#059669' }}>
              Revenue
            </span>
          </div>
          <div className="stat-card-value" style={{ color: '#059669', fontSize: 20, letterSpacing: '-0.5px' }}>
            {formatCurrency(totalPremium)}
          </div>
          <div className="stat-card-label">Total Premium</div>
        </div>

        {/* Expiring Soon */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--fire)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: 'var(--fire-bg)', color: 'var(--fire)' }}>
              <AlertTriangle size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: 'var(--fire-bg)', color: 'var(--fire)' }}>
              Alert
            </span>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--fire)' }}>{expiring.length}</div>
          <div className="stat-card-label">Expiring in 30 Days</div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="dashboard-row">
        {/* Expiring Soon List */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <AlertTriangle size={15} style={{ color: 'var(--fire)' }} />
              Policies Expiring Soon
            </span>
            {expiring.length > 0 && (
              <Link href="/dashboard/customers?filter=expiring" className="btn btn-sm btn-ghost">
                View all <ArrowRight size={13} />
              </Link>
            )}
          </div>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {expiring.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 10px' }}>
                <div className="empty-state-icon">✅</div>
                <h3>All Clear!</h3>
                <p>No policies expiring in the next 30 days.</p>
              </div>
            ) : (
              expiring.map(p => {
                const days = daysUntilExpiry(p.endDate);
                return (
                  <div key={p._id} className="expiry-item">
                    <PolicyBadge type={p.type} />
                    <div className="expiry-item-info">
                      <div className="expiry-item-name">{p.customerName}</div>
                      <div className="expiry-item-meta">
                        {p.policyNumber} · Expires {formatDate(p.endDate)}
                      </div>
                    </div>
                    <span className="expiry-days">
                      {days === 0 ? 'Today' : `${days}d`}
                    </span>
                    <Link href={`/dashboard/customers/${p._id}`} className="btn btn-sm btn-ghost">
                      View
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recently Added */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Clock size={15} style={{ color: 'var(--primary)' }} />
              Recently Added
            </span>
            <Link href="/dashboard/customers" className="btn btn-sm btn-ghost">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 10px' }}>
                <div className="empty-state-icon">📋</div>
                <h3>No customers yet</h3>
                <p>Add your first customer to get started.</p>
                <Link href="/dashboard/customers/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                  <Plus size={14} /> Add Customer
                </Link>
              </div>
            ) : (
              recent.map(p => {
                const initials = p.customerName
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                // compute status client-side from endDate string
                const today   = new Date(); today.setHours(0,0,0,0);
                const in30    = new Date(today.getTime() + 30*24*60*60*1000);
                const endD    = new Date(p.endDate);
                const status  = endD < today ? 'Expired'
                              : endD <= in30 ? 'Expiring Soon'
                              : 'Active';
                return (
                  <div key={p._id} className="recent-item">
                    <div className="recent-avatar">{initials}</div>
                    <div className="recent-info">
                      <div className="recent-name">{p.customerName}</div>
                      <div className="recent-meta">
                        <PolicyBadge type={p.type} /> &nbsp;
                        {p.policyNumber}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                    <Link href={`/dashboard/customers/${p._id}`} className="btn btn-sm btn-ghost" style={{ marginLeft: 4 }}>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Add CTA ── */}
      {total === 0 && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-mid) 100%)',
            border: 'none',
            padding: 32,
            textAlign: 'center',
            color: '#fff',
          }}
        >
          <Shield size={40} style={{ opacity: .7, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
            Welcome to InsureCRM
          </h2>
          <p style={{ opacity: .8, marginBottom: 20, fontSize: 14 }}>
            Start by adding your first customer policy record.
          </p>
          <Link href="/dashboard/customers/new" className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)', fontWeight: 700 }}>
            <Plus size={18} /> Add First Customer
          </Link>
        </div>
      )}
    </div>
  );
}
