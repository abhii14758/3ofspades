'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useLobbyStore } from '@/store/lobbyStore';
import { useSession, signOut } from 'next-auth/react';
import { useActiveGame } from '@/hooks/useActiveGame';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
} as const;
const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const RULES = [
  { icon: '🃏', title: '48-Card Deck', desc: 'Standard deck minus all fours 2s' },
  { icon: '👥', title: '6 Players', desc: '8 cards each · 8 tricks per round' },
  { icon: '📢', title: 'Bid from 130', desc: 'Highest bidder names trump suit' },
  { icon: '🤝', title: 'Secret Partners', desc: 'Bid winner calls 2 hidden partner cards' },
  { icon: '♠', title: '3 of Spades = 30 pts', desc: 'The most powerful card in the game' },
  { icon: '🏆', title: 'First to 500 wins', desc: 'Multi-round team scoring' },
];

const CARD_VALUES = [
  { label: '3 ♠', pts: 30, color: 'text-yellow-400' },
  { label: 'A / K / Q / J / 10', pts: 10, color: 'text-slate-200' },
  { label: '5', pts: 5, color: 'text-slate-400' },
  { label: 'All others', pts: 0, color: 'text-slate-600' },
];

export default function HomePage() {
  const { isConnected } = useLobbyStore();
  const { data: session } = useSession();
  const { activeRoomId, loading: activeLoading } = useActiveGame();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* ── Background decorative suits ── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0">
        <span className="absolute -top-10 -left-10 text-[22rem] font-black text-slate-800/[0.07] leading-none">♠</span>
        <span className="absolute -bottom-16 -right-6 text-[20rem] font-black text-slate-800/[0.07] leading-none">♣</span>
        <span className="absolute top-1/3 right-[6%] text-[15rem] font-black text-slate-800/[0.05] leading-none">♥</span>
        <span className="absolute bottom-1/4 left-[8%] text-[13rem] font-black text-slate-800/[0.05] leading-none">♦</span>
      </div>

      {/* ── Top-right header bar ── */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 text-xs">
        {session?.user ? (
          <>
            <span className="text-slate-400 hidden sm:block">
              👤 <span className="font-medium text-slate-200">{session.user.name}</span>
            </span>
            <Link href="/profile" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-slate-500 hover:text-red-400 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Sign In
          </Link>
        )}
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-full px-3 py-1.5">
          <span className={`w-2 h-2 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)]' : 'bg-slate-600 animate-pulse'}`} />
          <span className={isConnected ? 'text-green-400' : 'text-slate-500'}>
            {isConnected ? 'Server ready' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* ── Active game banner ── */}
      {session?.user && activeRoomId && !activeLoading && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-2.5 rounded-xl bg-indigo-950/80 backdrop-blur border border-indigo-700/60 text-indigo-200 text-sm flex items-center gap-4 shadow-lg shadow-indigo-900/30"
          >
            <span>You have an active game!</span>
            <button
              onClick={() => router.push(`/game/${activeRoomId}`)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg font-semibold transition-colors"
            >
              Rejoin Game
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div variants={container} initial="hidden" animate="visible" className="flex flex-col items-center gap-6 max-w-lg w-full">

          {/* Suit icons */}
          <motion.div variants={item} className="flex gap-4 text-5xl">
            <span className="text-slate-200 drop-shadow">♠</span>
            <span className="text-red-400 drop-shadow">♥</span>
            <span className="text-red-400 drop-shadow">♦</span>
            <span className="text-slate-200 drop-shadow">♣</span>
          </motion.div>

          {/* Title */}
          <motion.div variants={item}>
            <h1 className="text-7xl sm:text-8xl font-black tracking-tighter leading-none bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              3 of Spades
            </h1>
            <p className="text-slate-500 tracking-[0.25em] text-sm uppercase mt-3 font-medium">
              Kali Teeri · Kali Ni Tidi
            </p>
          </motion.div>

          {/* Special card badge */}
          <motion.div variants={item} className="inline-flex items-center gap-2 bg-amber-900/30 border border-amber-500/50 rounded-full px-5 py-2 text-amber-400 text-sm font-bold shadow-lg shadow-amber-900/20">
            ♠ 3 of Spades — 30 Points — The Crown Jewel
          </motion.div>

          {/* Tagline */}
          <motion.p variants={item} className="text-slate-400 text-base leading-relaxed max-w-sm">
            A 6-player trick-taking card game. Bid to become the declarer, secretly call your partners, choose trump, and dominate the table.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Link
              href="/lobby?tab=create"
              className="flex-1 py-4 rounded-2xl font-bold text-sm bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 active:scale-95 transition-all text-center shadow-xl shadow-green-900/40 border border-green-500/50 text-white"
            >
              🎴 Create Room
            </Link>
            <Link
              href="/lobby?tab=join"
              className="flex-1 py-4 rounded-2xl font-bold text-sm bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-center border border-slate-600 hover:border-slate-400 text-slate-200"
            >
              🔑 Join Room
            </Link>
          </motion.div>

          {/* Quick facts */}
          <motion.div variants={item} className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-600 mt-1">
            <span>6 players</span><span>·</span>
            <span>48 cards</span><span>·</span>
            <span>Bid starts at 130</span><span>·</span>
            <span>LAN / localhost</span><span>·</span>
            <span>Bots supported</span>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-700"
        >
          <span className="text-xs tracking-widest uppercase">How to play</span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-lg">↓</motion.div>
        </motion.div>
      </section>

      {/* ── Rules section ── */}
      <section className="relative z-10 px-6 py-20 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-black text-center mb-2">Game Overview</h2>
          <p className="text-slate-500 text-center text-sm mb-10">Everything you need to know</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {RULES.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
              >
                <span className="text-3xl">{r.icon}</span>
                <p className="font-bold text-sm text-white">{r.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Card values ── */}
      <section className="relative z-10 px-6 pb-20 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-black text-center mb-2">Card Values</h2>
          <p className="text-slate-500 text-center text-sm mb-8">Total points per round = 250</p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {CARD_VALUES.map((cv, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-6 py-4 ${
                  i === 0
                    ? 'bg-amber-950/30 border-b border-amber-900/30'
                    : i < CARD_VALUES.length - 1
                    ? 'border-b border-slate-800'
                    : ''
                }`}
              >
                <span className={`font-bold text-sm ${i === 0 ? 'text-amber-400' : cv.color}`}>{cv.label}</span>
                <span className={`font-black text-lg ${i === 0 ? 'text-amber-400' : cv.pts > 0 ? 'text-yellow-400' : 'text-slate-600 font-bold'}`}>
                  {cv.pts > 0 ? `${cv.pts} pts` : '—'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Round flow ── */}
      <section className="relative z-10 px-6 pb-20 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-black text-center mb-8">Round Flow</h2>
          <ol className="relative border-l border-slate-800 space-y-6 pl-8">
            {[
              ['Deal', '8 cards to each of 6 players from a 48-card deck'],
              ['Bid', 'Starting at 130, players bid in increments of 10 or pass'],
              ['Trump', 'Highest bidder declares the trump suit'],
              ['Partners', 'Bid winner secretly nominates 2 partner cards'],
              ['Play', '8 tricks played — must follow suit if possible'],
              ['Score', 'Bid team must reach their bid; failure costs them the bid amount'],
              ['Repeat', 'First team to 500 total points wins the game'],
            ].map(([step, desc], i) => (
              <li key={step} className="relative">
                <span className="absolute -left-[2.35rem] w-6 h-6 rounded-full bg-slate-800 border border-amber-700/40 flex items-center justify-center text-xs font-black text-amber-400">{i + 1}</span>
                <p className="font-bold text-sm text-white">{step}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </li>
            ))}
          </ol>
        </motion.div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 px-6 pb-24 flex flex-col items-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link href="/lobby?tab=create" className="px-10 py-4 rounded-2xl font-bold text-sm bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 active:scale-95 transition-all shadow-xl shadow-green-900/40 border border-green-500/50 text-white text-center">
            🎴 Create Room
          </Link>
          <Link href="/lobby?tab=join" className="px-10 py-4 rounded-2xl font-bold text-sm bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all border border-slate-600 hover:border-slate-400 text-slate-200 text-center">
            🔑 Join Room
          </Link>
        </motion.div>
        <p className="text-slate-700 text-xs">Create a free account to play and track your stats</p>
      </section>
    </div>
  );
}
