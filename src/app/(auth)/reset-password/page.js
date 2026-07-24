import { Suspense } from 'react';
import ResetPasswordContent from './ResetPasswordContent';

export const metadata = {
  title: 'Reset Password | InsureCRM',
  description: 'Set a new password for InsureCRM',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
