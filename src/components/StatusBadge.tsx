import { PolicyStatus } from '@/lib/types';

const cls: Record<PolicyStatus, string> = {
  Active: 'badge-active',
  Expired: 'badge-expired',
  'Expiring Soon': 'badge-expiring',
};

const dot: Record<PolicyStatus, string> = {
  Active: '●',
  Expired: '●',
  'Expiring Soon': '●',
};

interface Props {
  status: PolicyStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`badge ${cls[status]}`}>
      <span style={{ fontSize: 8 }}>{dot[status]}</span>
      {status}
    </span>
  );
}
