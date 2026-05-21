import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import SocketProvider from '@/components/providers/SocketProvider';
import NextAuthSessionProvider from '@/components/providers/SessionProvider';
import UserSync from '@/components/providers/UserSync';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: '3 of Spades | Kali Teeri',
  description: 'Multiplayer trick-taking card game — bid, choose trump, reveal partners, win tricks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white min-h-screen`}
      >
        <NextAuthSessionProvider>
          <UserSync />
          <SocketProvider>
            {children}
          </SocketProvider>
        </NextAuthSessionProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
            },
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
