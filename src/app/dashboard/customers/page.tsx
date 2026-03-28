import { Suspense } from 'react';
import CustomersListContent from './CustomersContent';

export default function CustomersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <CustomersListContent />
    </Suspense>
  );
}
