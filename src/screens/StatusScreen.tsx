import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '../components/Header';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { socket } from '../socket';

interface ServiceDetail {
  id: string;
  nameEn: string;
  nameGu: string;
  durationMinutes: number;
  price: number;
}

interface BarberDetail {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'On break';
  isOnDuty: boolean;
}

interface QueueEntryDetails {
  id: string;
  token: string;
  customerName: string;
  phone: string;
  services: ServiceDetail[];
  preferredBarber: BarberDetail | null;
  assignedBarber: BarberDetail | null;
  status: 'Waiting' | 'Called' | 'In chair' | 'Done' | 'Cancelled' | 'No-show';
  createdAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedWaitMinutes: number;
  position: number;
  totalDurationMinutes: number;
  totalPrice: number;
}

interface StatusScreenProps {
  id?: string;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({ id }) => {
  const { language, t } = useLanguage();

  const [entry, setEntry] = useState<QueueEntryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchEntry = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await fetch(`/api/queue/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(t('status.spotNotFound'));
        }
        throw new Error('Failed to load queue status');
      }
      const data: QueueEntryDetails = await res.json();
      setEntry(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading status');
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchEntry();

    // Socket.IO live updates
    const onQueueUpdate = () => {
      fetchEntry();
    };

    socket.on('queue:updated', onQueueUpdate);
    return () => {
      socket.off('queue:updated', onQueueUpdate);
    };
  }, [fetchEntry]);

  // Phone vibration when called
  useEffect(() => {
    if (entry?.status === 'Called') {
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([300, 150, 300, 150, 500]);
        } catch (e) {
          console.log('Vibration blocked or not supported');
        }
      }
    }
  }, [entry?.status]);

  // Handle Cancel Spot
  const handleConfirmCancel = async () => {
    if (!id || cancelling) return;
    try {
      setCancelling(true);
      const res = await fetch(`/api/queue/${id}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to cancel spot');
      }
      // Re-fetch to update state to 'Cancelled'
      await fetchEntry();
      setShowCancelModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  // Helper to clear token and navigate
  const handleExitToHome = () => {
    localStorage.removeItem('salon_active_token_id');
    window.location.href = '/';
  };

  const handleExitToJoin = () => {
    localStorage.removeItem('salon_active_token_id');
    window.location.href = '/join';
  };

  // Format position string (1st, 2nd, 3rd, 4th... with Gujarati support)
  const positionText = useMemo(() => {
    if (!entry || entry.position <= 0) return '';
    const pos = entry.position;

    if (language === 'gu') {
      const guDigits = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
      const guNum = String(pos).split('').map((d) => guDigits[parseInt(d)] || d).join('');
      if (pos === 1) return `લાઇનમાં ${guNum}લા (${t('status.youAreNext')})`;
      if (pos === 2) return `લાઇનમાં ${guNum}જા`;
      if (pos === 3) return `લાઇનમાં ${guNum}જા`;
      return `લાઇનમાં ${guNum}થા`;
    }

    if (pos === 1) return `1st ${t('status.positionInLine')} (${t('status.youAreNext')})`;
    if (pos === 2) return `2nd ${t('status.positionInLine')}`;
    if (pos === 3) return `3rd ${t('status.positionInLine')}`;
    return `${pos}th ${t('status.positionInLine')}`;
  }, [entry, language, t]);

  // SVG Circular countdown parameters
  const ringRadius = 50;
  const ringCircumference = 2 * Math.PI * ringRadius; // ~314.16

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header showBackHome />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-44 bg-charcoal-800 border-2 border-gold/30 rounded-2xl"></div>
          <div className="h-56 bg-charcoal-800 border-2 border-gold/20 rounded-2xl"></div>
          <div className="h-28 bg-charcoal-800 border-2 border-gold/20 rounded-2xl"></div>
        </main>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header showBackHome />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-12 text-center">
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 shadow-xl">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm text-charcoal-200/90 mb-6">{error || t('status.spotNotFound')}</p>
            <div className="space-y-3">
              <button
                onClick={fetchEntry}
                type="button"
                className="w-full btn-tap-target py-2.5 px-4 rounded-xl bg-charcoal-700 text-gold border border-gold/40 font-semibold text-xs hover:bg-charcoal-700/80 transition-all"
              >
                {t('app.retry')}
              </button>
              <button
                onClick={handleExitToHome}
                type="button"
                className="w-full btn-tap-target py-2.5 px-4 rounded-xl bg-charcoal-800 text-charcoal-200 border border-charcoal-700 font-semibold text-xs hover:bg-charcoal-700 transition-all"
              >
                {t('app.backHome')}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // STATE 4: CALLED — Full-screen Gold Screen
  // ==========================================
  if (entry.status === 'Called') {
    const barberToAttend = entry.assignedBarber?.name || entry.preferredBarber?.name || 'Barber';

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-gold via-gold-500 to-amber-600 text-charcoal-950 flex flex-col justify-between p-6 select-none animate-pulse">
        {/* Top Header */}
        <div className="flex items-center justify-between w-full max-w-[390px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <span className="font-extrabold text-sm uppercase tracking-wider">{t('app.title')}</span>
          </div>
          <Header showBackHome={false} />
        </div>

        {/* Center Calling Content */}
        <div className="w-full max-w-[390px] mx-auto flex flex-col items-center text-center my-auto py-6">
          <div className="w-24 h-24 rounded-full bg-charcoal-950/15 border-4 border-charcoal-950/30 flex items-center justify-center text-5xl mb-6 shadow-inner animate-bounce">
            🔔
          </div>

          <div className="text-6xl sm:text-7xl font-black text-charcoal-950 tracking-wider mb-2 font-mono">
            {entry.token}
          </div>

          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-charcoal-950 mb-3">
            {t('status.yourTurn')}
          </h2>

          <div className="inline-flex items-center gap-3 bg-charcoal-950/15 border border-charcoal-950/20 px-6 py-3 rounded-2xl mb-4 shadow-sm">
            <BarberAvatar name={barberToAttend} size="md" className="border-charcoal-950" />
            <span className="text-xl sm:text-2xl font-black text-charcoal-950">
              {language === 'gu'
                ? `${barberToAttend} ${t('status.goToBarber')}`
                : `${t('status.goToBarber')} ${barberToAttend}`}
            </span>
          </div>

          <p className="text-xs font-bold text-charcoal-950/80 uppercase tracking-widest mt-2">
            {t('status.startComing')}
          </p>
        </div>

        {/* Bottom helper */}
        <div className="w-full max-w-[390px] mx-auto text-center pb-4">
          <div className="bg-charcoal-950/10 rounded-xl py-2 px-4 text-xs font-semibold text-charcoal-950/80">
            {t('status.title')}: #{entry.token} · {entry.customerName}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE 5: IN CHAIR
  // ==========================================
  if (entry.status === 'In chair') {
    const attendingBarber = entry.assignedBarber?.name || entry.preferredBarber?.name || 'Barber';

    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-gold/15 border-2 border-gold/40 flex items-center justify-center text-5xl mb-6 text-gold">
            💆
          </div>

          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold bg-gold/20 text-gold border border-gold/40 mb-3">
            {entry.token} · {t('status.inChair')}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal-50 mb-2">
            {t('status.inChair')}
          </h2>

          <p className="text-sm text-charcoal-200/70 mb-8 max-w-xs">
            {t('status.inChairSub')}
          </p>

          <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-5 shadow-xl text-left">
            <div className="flex items-center gap-3 pb-3 border-b border-charcoal-700/60 mb-3">
              <BarberAvatar name={attendingBarber} size="md" />
              <div>
                <p className="text-xs text-charcoal-200/60">{t('status.chosenBarber')}</p>
                <p className="font-bold text-sm text-charcoal-50">{attendingBarber}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-charcoal-200/60 mb-1.5">{t('status.chosenServices')}</p>
              <div className="space-y-1.5">
                {entry.services.map((srv) => (
                  <div key={srv.id} className="flex justify-between text-xs text-charcoal-200/90">
                    <span>{language === 'gu' ? srv.nameGu : srv.nameEn}</span>
                    <span className="text-gold font-bold">₹{srv.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // STATE 6: DONE (Thank You)
  // ==========================================
  if (entry.status === 'Done') {
    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-4xl mb-6 text-emerald-400">
            ✨
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-charcoal-800 text-charcoal-200 border border-charcoal-700 mb-3">
            {entry.token}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal-50 mb-2">
            {t('status.done')}
          </h2>

          <p className="text-sm text-charcoal-200/70 mb-8 max-w-xs">
            {t('status.doneSub')}
          </p>

          <button
            onClick={handleExitToHome}
            type="button"
            className="w-full btn-tap-target py-3.5 px-6 rounded-2xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-sm shadow-xl active:scale-[0.99] transition-all"
          >
            {t('status.backHome')}
          </button>
        </main>
      </div>
    );
  }

  // ==========================================
  // STATE 7: NO-SHOW
  // ==========================================
  if (entry.status === 'No-show') {
    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-4xl mb-6 text-amber-400">
            ⏳
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-charcoal-800 text-amber-400 border border-amber-500/30 mb-3">
            {entry.token}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-charcoal-50 mb-3">
            {t('status.noShow')}
          </h2>

          <p className="text-xs text-charcoal-200/60 mb-8 max-w-xs">
            Your spot has timed out. To rejoin the queue, please tap below.
          </p>

          <button
            onClick={handleExitToJoin}
            type="button"
            className="w-full btn-tap-target py-3.5 px-6 rounded-2xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-sm shadow-xl active:scale-[0.99] transition-all"
          >
            {t('status.rejoin')} →
          </button>
        </main>
      </div>
    );
  }

  // ==========================================
  // STATE 8: CANCELLED
  // ==========================================
  if (entry.status === 'Cancelled') {
    return (
      <div className="min-h-screen bg-charcoal-900 flex flex-col">
        <Header />
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center text-4xl mb-6 text-red-400">
            ✕
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-charcoal-50 mb-2">
            {t('status.cancelled')}
          </h2>

          <p className="text-xs text-charcoal-200/60 mb-8 max-w-xs">
            {t('status.cancelledMsg')}
          </p>

          <button
            onClick={handleExitToHome}
            type="button"
            className="w-full btn-tap-target py-3.5 px-6 rounded-2xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-sm shadow-xl active:scale-[0.99] transition-all"
          >
            {t('status.backHome')}
          </button>
        </main>
      </div>
    );
  }

  // ==========================================
  // STATE 1 & 2 & 3: WAITING (Main Screen)
  // ==========================================
  const isSecondInLine = entry.position === 2;
  const isPreferredBarberOnBreak = entry.preferredBarber?.status === 'On break';

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col pb-16">
      <Header showBackHome />

      <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-5 space-y-5">
        {/* STATE 2: 2nd in line Alert Banner */}
        {isSecondInLine && (
          <div className="bg-gradient-to-r from-amber-500/20 via-gold/20 to-amber-500/20 border-2 border-gold rounded-2xl p-4 text-center shadow-lg animate-pulse flex items-center justify-center gap-2.5">
            <span className="text-2xl">🏃‍♂️</span>
            <p className="font-black text-gold text-sm tracking-wide">
              {t('status.startComing')}
            </p>
          </div>
        )}

        {/* STATE 3: Barber On-break Notice */}
        {isPreferredBarberOnBreak && entry.preferredBarber && (
          <div className="bg-purple-500/15 border border-purple-500/40 rounded-2xl p-3 text-center flex items-center justify-center gap-2">
            <span className="text-lg">☕</span>
            <p className="text-xs font-bold text-purple-200">
              {entry.preferredBarber.name} {t('status.barberOnBreak')}
            </p>
          </div>
        )}

        {/* Large Token & Position Card */}
        <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-3xl p-6 text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-75"></div>

          <p className="text-xs font-bold uppercase tracking-wider text-charcoal-200/50 mb-1">
            {t('status.title')}
          </p>

          {/* Large Token */}
          <div className="text-6xl sm:text-7xl font-black text-gold tracking-wider mb-2 font-mono">
            {entry.token}
          </div>

          {/* Position in line */}
          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold bg-charcoal-900 text-charcoal-100 border border-charcoal-700 shadow-inner">
            {positionText}
          </div>
        </div>

        {/* Circular Countdown of Estimated Wait */}
        <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-3xl p-6 flex flex-col items-center justify-center shadow-xl">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
              {/* Background track */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                className="stroke-charcoal-700 fill-none"
                strokeWidth="8"
              />
              {/* Gold Progress Ring */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                className="stroke-gold fill-none transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray={ringCircumference}
                strokeDashoffset={
                  entry.estimatedWaitMinutes === 0
                    ? 0
                    : ringCircumference * 0.25 // Smooth decorative ring offset
                }
                strokeLinecap="round"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {entry.estimatedWaitMinutes > 0 ? (
                <>
                  <span className="text-xs text-charcoal-200/60 font-semibold leading-tight">
                    {t('status.estimatedWait')}
                  </span>
                  <span className="text-3xl font-black text-gold tracking-tight leading-none my-0.5">
                    {entry.estimatedWaitMinutes}
                  </span>
                  <span className="text-xs text-charcoal-200/80 font-bold uppercase tracking-wider">
                    {t('status.min')}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl mb-0.5">⚡</span>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-tight leading-tight px-1">
                    {t('status.youAreNext')}
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-charcoal-200/50 mt-3 font-medium">
            {t('status.estimatedWaitLabel')}
          </p>
        </div>

        {/* Chosen Barber & Services Details */}
        <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 shadow-sm space-y-4">
          {/* Barber Section */}
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-700/60">
            <div className="flex items-center gap-3">
              {entry.preferredBarber ? (
                <BarberAvatar name={entry.preferredBarber.name} size="md" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-gold text-lg">
                  ⚡
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold text-charcoal-200/50 uppercase tracking-wider">
                  {t('status.chosenBarber')}
                </p>
                <p className="font-bold text-sm text-charcoal-50">
                  {entry.preferredBarber ? entry.preferredBarber.name : t('status.anyBarber')}
                </p>
              </div>
            </div>

            {entry.preferredBarber && (
              <div>
                {entry.preferredBarber.status === 'On break' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    {t('barberStatus.onBreak')}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {t('barberStatus.available')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Services List */}
          <div>
            <p className="text-[11px] font-semibold text-charcoal-200/50 uppercase tracking-wider mb-2">
              {t('status.chosenServices')} ({entry.services.length})
            </p>
            <div className="space-y-2">
              {entry.services.map((srv) => (
                <div
                  key={srv.id}
                  className="flex items-center justify-between text-xs p-2 rounded-xl bg-charcoal-900/60 border border-charcoal-700/40"
                >
                  <div>
                    <span className="font-bold text-charcoal-100">
                      {language === 'gu' ? srv.nameGu : srv.nameEn}
                    </span>
                    <span className="text-charcoal-200/50 ml-2">({srv.durationMinutes} {t('status.min')})</span>
                  </div>
                  <span className="text-gold font-extrabold">₹{srv.price}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 mt-3 border-t border-charcoal-700/60 text-xs">
              <span className="text-charcoal-200/60 font-semibold">{t('status.total')}</span>
              <span className="text-sm font-extrabold text-gold">
                ₹{entry.totalPrice} · {entry.totalDurationMinutes} {t('status.min')}
              </span>
            </div>
          </div>
        </div>

        {/* Cancel Spot Button (Only while Waiting) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="w-full btn-tap-target flex items-center justify-center py-3 px-4 rounded-xl text-xs font-semibold text-charcoal-200/70 hover:text-red-400 border border-charcoal-700/80 hover:border-red-500/40 transition-colors"
          >
            {t('status.cancelSpot')}
          </button>
        </div>
      </main>

      {/* Confirmation Modal for Cancel */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-charcoal-800 border border-charcoal-700 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>

            <div>
              <h3 className="font-bold text-base text-charcoal-50 mb-1">
                {t('status.cancelConfirmTitle')}
              </h3>
              <p className="text-xs text-charcoal-200/70">
                {t('status.cancelConfirmMsg')}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="w-full btn-tap-target py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow"
              >
                {cancelling ? 'Cancelling...' : t('status.cancelConfirmYes')}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="w-full btn-tap-target py-2.5 px-4 rounded-xl bg-charcoal-700 hover:bg-charcoal-700/80 text-charcoal-100 font-semibold text-xs border border-charcoal-700 transition-colors"
              >
                {t('status.cancelConfirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
