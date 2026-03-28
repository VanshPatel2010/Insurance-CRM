'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * This redirects /customers/[id]/edit → /customers/new?id=[id]
 * so the shared Add/Edit form handles the editing logic.
 */
export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/customers/new?id=${id}`);
    }
  }, [id, router]);

  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading editor…
    </div>
  );
}
