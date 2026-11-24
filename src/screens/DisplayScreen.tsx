import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { socket } from '../socket';
import { apiUrl } from '../apiBase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarberRow {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'On break';
  currentToken: string | null;
  customerStatus: string | null;
  isNewlyCalled: boolean;
}

interface UpNextEntry {
  id: string;
  token: string;
  estimatedWaitMinutes: number;
}

interface DisplayData {
  barbers: BarberRow[];
  upNext: UpNextEntry[];
  isOnlineQueueOpen: boolean;
}

// ─── Web Audio chime (synthesized, no npm packages) ───────────────────────────

function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;

  const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const duration = 0.35;
  const gap = 0.12;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * gap);

    const start = now + i * gap;
    const end = start + duration;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.start(start);
    osc.stop(end + 0.05);
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const DisplayScreen: React.FC = () => {
  const { t } = useLanguage();

  const [data, setData] = useState<DisplayData | null>(null);
  const [loading, setLoading] = useState(true);

  // Clock — updated every minute
  const [clockStr, setClockStr] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  // Track which barber IDs have a newly-called token so we detect new ones
  const prevNewlyCalledRef = useRef<Set<string>>(new Set());

  // Web Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const soundUnlockedRef = useRef(false);

  // Gold-flash state: set of barber IDs currently flashing
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getOrCreateAudioCtx = useCallback((): AudioContext | null => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const tryPlayChime = useCallback(async () => {
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      // Browser blocked; show banner
      setSoundBlocked(true);
      return;
    }

    setSoundBlocked(false);
    playChime(ctx);
  }, [getOrCreateAudioCtx]);

  const handlePageClick = useCallback(async () => {
    if (soundUnlockedRef.current) return;
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    soundUnlockedRef.current = true;
    setSoundBlocked(false);
    // Play a soft chime to confirm sound is enabled
    playChime(ctx);
  }, [getOrCreateAudioCtx]);

  // Trigger gold flash + chime for a barber ID, 5 seconds
  const triggerFlash = useCallback(
    (barberId: string) => {
      setFlashingIds((prev) => new Set(prev).add(barberId));

      // Clear any existing timer for this barber
      const existing = flashTimers.current.get(barberId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setFlashingIds((prev) => {
          const next = new Set(prev);
          next.delete(barberId);
          return next;
        });
        flashTimers.current.delete(barberId);
      }, 5000);

      flashTimers.current.set(barberId, timer);
      tryPlayChime();
    },
    [tryPlayChime]
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchDisplay = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/display'));
      if (!res.ok) throw new Error('Failed to load display data');
      const incoming: DisplayData = await res.json();

      // Detect newly called barbers since last fetch
      const nowNewlyCalledIds = new Set(
        incoming.barbers
          .filter((b) => b.isNewlyCalled)
          .map((b) => b.id)
      );

      nowNewlyCalledIds.forEach((id) => {
        if (!prevNewlyCalledRef.current.has(id)) {
          triggerFlash(id);
        }
      });

      prevNewlyCalledRef.current = nowNewlyCalledIds;
      setData(incoming);
    } catch (err) {
      console.error('[Display] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [triggerFlash]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Eagerly create AudioContext so we can detect suspended state early
    const ctx = getOrCreateAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      setSoundBlocked(true);
    }

    fetchDisplay();

    socket.on('queue:updated', fetchDisplay);

    // Clock tick every 30s (accurate enough, never off by more than 30s)
    const clockInterval = setInterval(() => {
      const d = new Date();
      setClockStr(
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    }, 30_000);

    return () => {
      socket.off('queue:updated', fetchDisplay);
      clearInterval(clockInterval);
      // Clear all flash timers
      flashTimers.current.forEach((t) => clearTimeout(t));
    };
  }, [fetchDisplay, getOrCreateAudioCtx]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center">
        <span className="text-5xl text-gold animate-pulse">✂️</span>
      </div>
    );
  }

  const barbers = data?.barbers ?? [];
  const upNext = data?.upNext ?? [];
  const isOpen = data?.isOnlineQueueOpen ?? true;

  return (
    // Full 1920×1080 canvas; click anywhere to unlock audio
    <div
      className="min-h-screen bg-charcoal-950 text-charcoal-50 flex flex-col select-none cursor-default overflow-hidden"
      onClick={handlePageClick}
    >
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-12 py-6 border-b border-charcoal-800">
        {/* Salon name */}
        <div className="flex items-center gap-4">
          <span className="text-5xl">✂️</span>
          <div>
            <h1 className="text-4xl font-black text-gold tracking-wide leading-none">
              {t('app.title')}
            </h1>
            <p className="text-lg text-charcoal-200/50 font-semibold tracking-widest uppercase mt-0.5">
              {t('display.title')}
            </p>
          </div>
        </div>

        {/* Clock + open badge */}
        <div className="flex items-center gap-6">
          <span
            className={`text-sm font-bold px-4 py-1.5 rounded-full border ${
              isOpen
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            {isOpen ? t('app.openStatus') : t('app.closedStatus')}
          </span>
          <span className="text-5xl font-mono font-black text-charcoal-200/80 tabular-nums">
            {clockStr}
          </span>
        </div>
      </header>

      {/* ── Main Grid: Barbers (left 60%) + Up Next (right 40%) ─────────── */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* ── Barber Rows ──────────────────────────────────────────────── */}
        <section className="flex-[3] flex flex-col justify-center px-12 py-8 gap-6 border-r border-charcoal-800">
          <h2 className="text-2xl font-extrabold text-charcoal-200/40 uppercase tracking-widest mb-2">
            {t('display.nowServing')}
          </h2>

          {barbers.length === 0 ? (
            <p className="text-3xl text-charcoal-200/40">{t('display.allBarbersFree')}</p>
          ) : (
            barbers.map((barber) => {
              const isFlashing = flashingIds.has(barber.id);
              const hasToken = barber.currentToken !== null;
              const isFree = barber.status === 'Available' && !hasToken;
              const isBreak = barber.status === 'On break';

              return (
                <div
                  key={barber.id}
                  className={`
                    flex items-center gap-8 px-8 py-6 rounded-3xl border-2 transition-all duration-500
                    ${
                      isFlashing
                        ? 'bg-gold/20 border-gold animate-pulse shadow-[0_0_60px_rgba(212,160,23,0.5)]'
                        : hasToken
                        ? 'bg-charcoal-800/80 border-charcoal-700'
                        : 'bg-charcoal-900/60 border-charcoal-800/60'
                    }
                  `}
                >
                  {/* Avatar */}
                  <div className="shrink-0">
                    <BarberAvatar name={barber.name} size="lg" />
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-4xl font-black text-charcoal-50 leading-none truncate">
                      {barber.name}
                    </p>
                    <p className="text-lg text-charcoal-200/50 font-semibold mt-1">
                      {isBreak
                        ? t('display.onBreak')
                        : isFree
                        ? t('display.free')
                        : barber.customerStatus === 'Called'
                        ? '🔔 Called'
                        : '✂️ In chair'}
                    </p>
                  </div>

                  {/* Token badge */}
                  {hasToken ? (
                    <div
                      className={`shrink-0 flex items-baseline gap-2 px-6 py-3 rounded-2xl ${
                        isFlashing
                          ? 'bg-gold text-charcoal-950'
                          : 'bg-gold/15 border border-gold/40'
                      }`}
                    >
                      <span
                        className={`text-sm font-bold uppercase tracking-widest ${
                          isFlashing ? 'text-charcoal-950' : 'text-gold/70'
                        }`}
                      >
                        {t('display.now')}:
                      </span>
                      <span
                        className={`text-6xl font-black font-mono leading-none tabular-nums ${
                          isFlashing ? 'text-charcoal-950' : 'text-gold'
                        }`}
                      >
                        {barber.currentToken}
                      </span>
                    </div>
                  ) : (
                    <div className="shrink-0 px-6 py-3 rounded-2xl border border-charcoal-700/40">
                      <span className="text-3xl font-bold text-charcoal-200/30">
                        {isBreak ? '☕' : '—'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* ── Up Next ──────────────────────────────────────────────────── */}
        <section className="flex-[2] flex flex-col px-10 py-8 gap-5">
          <h2 className="text-2xl font-extrabold text-charcoal-200/40 uppercase tracking-widest mb-2">
            {t('display.upNext')}
          </h2>

          {upNext.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-charcoal-200/25">
              <span className="text-7xl mb-4">✅</span>
              <p className="text-2xl font-semibold text-center">{t('display.noOneWaiting')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {upNext.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-7 py-5 rounded-2xl border ${
                    idx === 0
                      ? 'bg-gold/10 border-gold/40'
                      : 'bg-charcoal-800/50 border-charcoal-700/50'
                  }`}
                >
                  {/* Position dot */}
                  <div className="flex items-center gap-5">
                    <span
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-black ${
                        idx === 0
                          ? 'bg-gold text-charcoal-950'
                          : 'bg-charcoal-700 text-charcoal-200/60'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`font-black font-mono tabular-nums ${
                        idx === 0 ? 'text-5xl text-gold' : 'text-4xl text-charcoal-100'
                      }`}
                    >
                      {entry.token}
                    </span>
                  </div>

                  {/* Wait estimate */}
                  <div className="text-right">
                    {entry.estimatedWaitMinutes <= 0 ? (
                      <span className="text-2xl font-black text-emerald-400">You&apos;re next!</span>
                    ) : (
                      <>
                        <span
                          className={`font-black font-mono tabular-nums ${
                            idx === 0 ? 'text-4xl text-gold' : 'text-3xl text-charcoal-200/80'
                          }`}
                        >
                          ~{entry.estimatedWaitMinutes}
                        </span>
                        <span
                          className={`ml-1 text-xl font-semibold ${
                            idx === 0 ? 'text-gold/70' : 'text-charcoal-200/40'
                          }`}
                        >
                          min
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Sound Banner ─────────────────────────────────────────────────── */}
      {soundBlocked && (
        <div className="fixed bottom-0 inset-x-0 bg-charcoal-800/95 backdrop-blur border-t border-charcoal-700 py-4 px-10 flex items-center justify-center gap-3 z-50">
          <span className="text-2xl">🔊</span>
          <p className="text-xl font-semibold text-gold">{t('display.soundBanner')}</p>
        </div>
      )}
    </div>
  );
};
