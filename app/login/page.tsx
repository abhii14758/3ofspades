import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AuthCard from '@/components/auth/AuthCard';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/lobby');

  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}
