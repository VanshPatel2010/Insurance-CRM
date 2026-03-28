import { PolicyType } from '@/lib/types';

const labels: Record<PolicyType, string> = {
  motor: 'Motor',
  medical: 'Medical',
  fire: 'Fire',
  life: 'Life',
};

interface Props {
  type: PolicyType;
}

export default function PolicyBadge({ type }: Props) {
  return (
    <span className={`badge badge-${type}`}>
      {labels[type]}
    </span>
  );
}
