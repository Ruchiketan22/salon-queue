import React, { useState, useEffect, useCallback } from 'react';
import { PinGate } from '../components/PinGate';
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

interface BarberCurrentCustomer {
  id: string;
  token: string;
  customerName: string;
  phone: string;
  status: 'Called' | 'In chair';
  services: ServiceDetail[];
  calledAt?: string | null;
  startedAt?: string | null;
  totalDurationMinutes: number;
  totalPrice: number;
}

interface BarberNextCustomer {
  id: string;
  token: string;
  customerName: string;
  services: ServiceDetail[];
}

interface BarberData {
  barber: {
    id: string;
    name: string;
    status: 'Available' | 'Busy' | 'On break';
    isOnDuty: boolean;
  };
  currentCustomer: BarberCurrentCustomer | null;
  nextCustomer: BarberNextCustomer | null;
}

interface BarberScreenProps {
  name?: string;
}

export const BarberScreen: React.FC<BarberScreenProps> = ({ name }) => {
  const { language, toggleLanguage, t } = useLanguage();

  const [data, setData] = useState<BarberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [, setSecondsTick] = useState(0);

  const barberSlug = (name || '').trim();

  const fetchBarberData = useCallback(async () => {
    if (!barberSlug) return;
    try {
      setError(null);
      const res = await fetch(`/api/barber/${encodeURIComponent(barberSlug)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(t('barber.barberNotFound'));
        }
        throw new Error('Failed to load barber view');
      }
      const barberData: BarberData = await res.json();
      setData(barberData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading barber view');
    } finally {
      setLoading(false);
    }
  }, [barberSlug, t]);

  useEffect(() => {
    fetchBarberData();

    // Socket.IO live sync
    const onQueueUpdate = () => {
      fetchBarberData();
    };

    socket.on('queue:updated', onQueueUpdate);

    // 1-second ticking timer for elapsed service duration
    const interval = setInterval(() => {
      setSecondsTick((s) => s + 1);
    }, 1000);

    return () => {
      socket.off('queue:updated', onQueueUpdate);
      clearInterval(interval);
    };
  }, [fetchBarberData]);

  // Toggle On break / Available
  const handleToggleBreak = async () => {
    if (!data?.barber.id || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/barber/toggle-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId: data.barber.id }),
      });
      if (!res.ok) throw new Error('Failed to toggle break status');
      fetchBarberData();
    } catch (err: any) {
      alert(err.message || 'Error toggling break');
    } finally {
      setActionLoading(false);
    }
  };

  // Start Service (Called -> In chair)
  const handleStart = async (entryId: string) => {
    if (!data?.barber.id || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/barber/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, barberId: data.barber.id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to start service');
      }
      fetchBarberData();
    } catch (err: any) {
      alert(err.message || 'Error starting service');
    } finally {
      setActionLoading(false);
    }
  };

  // Done Service (In chair -> Done)
  const handleDone = async (entryId: string) => {
    if (!data?.barber.id || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/barber/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, barberId: data.barber.id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to complete service');
      }
      fetchBarberData();
    } catch (err: any) {
      alert(err.message || 'Error completing service');
    } finally {
      setActionLoading(false);
    }
  };

  // Lock session helper
  const handleLock = () => {
    localStorage.removeItem('salon_pin_barber');
    window.location.reload();
  };

  // Calculate elapsed time string MM:SS
  const formatElapsed = (startedAtStr?: string | null) => {
    if (!startedAtStr) return '00:00';
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(startedAtStr).getTime()) / 1000));
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(m)}:${pad(s)}`;
  };

  const barberName = data?.barber.name || barberSlug;

  return (
    <PinGate
      storageKey="salon_pin_barber"
      expectedPin="2222"
      title={`${barberName} · ${t('pin.barberTitle')}`}
      subtitle={t('pin.barberSubtitle')}
    >
      <div className="min-h-screen bg-charcoal-900 text-charcoal-50 flex flex-col justify-between pb-8">
        {/* Header */}
        <header className="bg-charcoal-800 border-b border-charcoal-700/80 px-4 py-3 sticky top-0 z-40 shadow-sm">
          <div className="max-w-[390px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BarberAvatar name={barberName} size="md" />
              <div>
                <h1 className="font-extrabold text-sm text-charcoal-50 leading-tight">
                  {barberName}
                </h1>
                <p className="text-[10px] text-charcoal-200/50 uppercase tracking-wider font-semibold">
                  {t('barber.title')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="btn-tap-target flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-charcoal-700 hover:bg-charcoal-700/80 text-charcoal-50 border border-gold/30"
              >
                <span className={language === 'en' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>EN</span>
                <span className="text-charcoal-600">|</span>
                <span className={language === 'gu' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>ગુજ</span>
              </button>

              {/* Lock Button */}
              <button
                type="button"
                onClick={handleLock}
                title={t('barber.lock')}
                className="btn-tap-target p-1.5 rounded-lg bg-charcoal-700/70 hover:bg-charcoal-700 text-charcoal-200/60 hover:text-charcoal-100 border border-charcoal-700 text-xs"
              >
                🔒
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-5 space-y-5">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 bg-charcoal-800 border-2 border-gold/20 rounded-2xl"></div>
              <div className="h-64 bg-charcoal-800 border-2 border-gold/20 rounded-2xl"></div>
              <div className="h-28 bg-charcoal-800 border-2 border-gold/20 rounded-2xl"></div>
            </div>
          ) : error || !data ? (
            <div className="p-6 bg-charcoal-800 border border-red-500/30 rounded-2xl text-center space-y-4">
              <p className="text-sm text-red-300">{error || t('barber.barberNotFound')}</p>
              <button
                type="button"
                onClick={fetchBarberData}
                className="btn-tap-target px-4 py-2 rounded-xl bg-charcoal-700 text-gold border border-gold/40 text-xs font-bold"
              >
                {t('app.retry')}
              </button>
            </div>
          ) : (
            <>
              {/* Break Toggle Card */}
              <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">
                    {data.barber.status === 'On break' ? '☕' : '💈'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-charcoal-100">
                      {t('barber.breakToggle')}
                    </p>
                    <p className="text-[11px] text-charcoal-200/60">
                      {data.barber.status === 'On break'
                        ? t('barber.onBreak')
                        : t('barber.available')}
                    </p>
                  </div>
                </div>

                {/* Switch button */}
                <button
                  type="button"
                  onClick={handleToggleBreak}
                  disabled={actionLoading}
                  className={`btn-tap-target relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    data.barber.status === 'On break' ? 'bg-purple-600' : 'bg-emerald-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      data.barber.status === 'On break' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Current Customer Card */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-200/60 px-1">
                  {t('barber.currentCustomerHeading')}
                </h2>

                {data.currentCustomer ? (
                  <div
                    className={`rounded-3xl p-5 border shadow-xl transition-all space-y-4 ${
                      data.currentCustomer.status === 'Called'
                        ? 'bg-gradient-to-b from-amber-500/15 to-charcoal-800 border-amber-500/60 animate-pulse'
                        : 'bg-charcoal-800 border-emerald-500/50'
                    }`}
                  >
                    {/* Status Banner */}
                    <div className="flex items-center justify-between pb-3 border-b border-charcoal-700/60">
                      <span className="text-xs font-bold text-charcoal-200/70">
                        {data.currentCustomer.status === 'Called'
                          ? `🔔 ${t('barber.calledAlert')}`
                          : `✨ In Chair`}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          data.currentCustomer.status === 'Called'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {data.currentCustomer.status}
                      </span>
                    </div>

                    {/* Customer Info & Large Token */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-black text-gold font-mono tracking-tight">
                          {data.currentCustomer.token}
                        </div>
                        <h3 className="font-extrabold text-base text-charcoal-50 mt-0.5">
                          {data.currentCustomer.customerName}
                        </h3>
                        <p className="text-xs text-charcoal-200/50 font-mono">
                          {data.currentCustomer.phone}
                        </p>
                      </div>

                      {/* Timer since start if In chair */}
                      {data.currentCustomer.status === 'In chair' && (
                        <div className="text-right bg-charcoal-900/80 px-3.5 py-2 rounded-2xl border border-charcoal-700/60">
                          <p className="text-[10px] text-charcoal-200/50 uppercase tracking-wider font-bold">
                            {t('barber.timerSinceStart')}
                          </p>
                          <p className="text-xl font-mono font-black text-emerald-400">
                            {formatElapsed(data.currentCustomer.startedAt)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Services */}
                    <div className="pt-1">
                      <p className="text-[11px] font-bold text-charcoal-200/60 uppercase tracking-wider mb-1.5">
                        {t('barber.servicesHeading')}
                      </p>
                      <div className="space-y-1">
                        {data.currentCustomer.services.map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between text-xs py-1 px-2.5 rounded-lg bg-charcoal-900/60 border border-charcoal-700/40"
                          >
                            <span className="font-semibold text-charcoal-100">
                              {language === 'gu' ? s.nameGu : s.nameEn}
                            </span>
                            <span className="text-gold font-bold">
                              {s.durationMinutes}m · ₹{s.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Big Action Button: [ Start ] or [ Done ] */}
                    <div className="pt-2">
                      {data.currentCustomer.status === 'Called' ? (
                        <button
                          type="button"
                          onClick={() => handleStart(data.currentCustomer!.id)}
                          disabled={actionLoading}
                          className="w-full btn-tap-target py-4 px-6 rounded-2xl bg-gold hover:bg-gold-light text-charcoal-950 font-black text-base shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {actionLoading ? 'Starting...' : `▶ ${t('barber.start')}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDone(data.currentCustomer!.id)}
                          disabled={actionLoading}
                          className="w-full btn-tap-target py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-charcoal-950 font-black text-base shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {actionLoading ? 'Completing...' : `✓ ${t('barber.done')}`}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* No customer card */
                  <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-3xl p-8 text-center shadow-md space-y-2">
                    <span className="text-4xl block mb-2">💈</span>
                    <p className="text-sm font-semibold text-charcoal-200/80 max-w-[260px] mx-auto">
                      {t('barber.noCustomer')}
                    </p>
                  </div>
                )}
              </div>

              {/* "Next for you" Preview Card */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-200/60 px-1">
                  {t('barber.nextForYou')}
                </h2>

                {data.nextCustomer ? (
                  <div className="bg-charcoal-800/90 border border-charcoal-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold font-mono font-black flex items-center justify-center text-sm">
                        {data.nextCustomer.token}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-charcoal-50">
                          {data.nextCustomer.customerName}
                        </p>
                        <p className="text-xs text-charcoal-200/60">
                          {data.nextCustomer.services.map((s) => (language === 'gu' ? s.nameGu : s.nameEn)).join(', ')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gold font-bold">Up next</span>
                  </div>
                ) : (
                  <div className="bg-charcoal-800/50 border border-charcoal-700/50 rounded-2xl p-4 text-center text-xs text-charcoal-200/40">
                    {t('barber.noNext')}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </PinGate>
  );
};
