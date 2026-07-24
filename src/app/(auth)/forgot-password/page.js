import { Suspense } from 'react';
import ForgotPasswordContent from './ForgotPasswordContent';

export const metadata = {
  title: 'Forgot Password | InsureCRM',
  description: 'Reset your password for InsureCRM',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
