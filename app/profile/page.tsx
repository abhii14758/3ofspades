import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ProfileClient from '@/components/profile/ProfileClient';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ProfileClient userId={session.user.id} userEmail={session.user.email ?? ''} />;
}
