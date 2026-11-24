import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PinGate } from '../components/PinGate';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { socket } from '../socket';
import { ServiceItem } from '../types';

interface ServiceDetail {
  id: string;
  nameEn: string;
  nameGu: string;
  durationMinutes: number;
  price: number;
}

interface CurrentCustomerInfo {
  id: string;
  token: string;
  customerName: string;
  phone: string;
  status: 'Called' | 'In chair';
  services: ServiceDetail[];
  totalMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  calledAt?: string | null;
  startedAt?: string | null;
}

interface ReceptionBarber {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'On break';
  isOnDuty: boolean;
  currentCustomer: CurrentCustomerInfo | null;
  isBusy: boolean;
  canCallNext: boolean;
}

interface QueueRow {
  id: string;
  token: string;
  customerName: string;
  phone: string;
  status: 'Waiting' | 'Called';
  services: ServiceDetail[];
  preferredBarber: { id: string; name: string } | null;
  assignedBarber: { id: string; name: string } | null;
  createdAt: string;
  calledAt?: string | null;
  waitedMinutes: number;
  isOver60: boolean;
  calledSecondsRemaining: number;
  isCountdownZero: boolean;
}

interface DashboardData {
  barbers: ReceptionBarber[];
  queueList: QueueRow[];
  queueCount: number;
}

export const ReceptionScreen: React.FC = () => {
  const { language, toggleLanguage, t } = useLanguage();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Walk-in Modal states
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPhoneTouched, setWalkInPhoneTouched] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [walkInBarberId, setWalkInBarberId] = useState<string | null>(null);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState(false);

  // 1-second interval tick for timers
  const [, setTimerTick] = useState(0);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/reception/dashboard');
      if (!res.ok) throw new Error('Failed to load reception dashboard');
      const data: DashboardData = await res.json();
      setDashboard(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (res.ok) {
        const data: ServiceItem[] = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchServices();

    // Socket.IO live sync
    const onQueueUpdate = () => {
      fetchDashboard();
    };

    socket.on('queue:updated', onQueueUpdate);

    // 1-second timer tick for countdowns
    const timer = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);

    return () => {
      socket.off('queue:updated', onQueueUpdate);
      clearInterval(timer);
    };
  }, [fetchDashboard, fetchServices]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Call Next Handler
  const handleCallNext = async (barberId: string, barberName: string) => {
    try {
      const res = await fetch('/api/reception/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NO_MATCHING_CUSTOMER') {
          showToast(`${barberName}: ${t('reception.noMatchForBarber')}`);
          return;
        }
        throw new Error(data.message || 'Failed to call next');
      }

      showToast(`Called ${data.entry.token} (${data.entry.customerName}) for ${barberName}`);
      fetchDashboard();
    } catch (err: any) {
      showToast(err.message || 'Error calling next customer');
    }
  };

  // Mark No-Show Handler
  const handleMarkNoShow = async (entryId: string, token: string) => {
    if (!window.confirm(`${t('reception.noShowConfirmTitle')} (${token})`)) return;

    try {
      const res = await fetch('/api/reception/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to mark no-show');
      }

      showToast(`Marked ${token} as No-show`);
      fetchDashboard();
    } catch (err: any) {
      showToast(err.message || 'Error marking no-show');
    }
  };

  // Cancel Spot Handler
  const handleCancelSpot = async (entryId: string, token: string) => {
    if (!window.confirm(`${t('reception.cancelConfirmTitle')} (${token})`)) return;

    try {
      const res = await fetch(`/api/queue/${entryId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to cancel');
      }

      showToast(`Cancelled ${token}`);
      fetchDashboard();
    } catch (err: any) {
      showToast(err.message || 'Error cancelling customer');
    }
  };

  // Walk-in modal submission
  const cleanWalkInPhone = useMemo(() => walkInPhone.replace(/\D/g, '').slice(0, 10), [walkInPhone]);
  const isWalkInPhoneValid = cleanWalkInPhone.length === 10;
  const isWalkInFormValid = walkInName.trim().length > 0 && isWalkInPhoneValid && selectedServiceIds.length > 0;

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWalkInFormValid || walkInSubmitting) return;

    try {
      setWalkInSubmitting(true);
      setWalkInError(null);

      const res = await fetch('/api/reception/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: walkInName.trim(),
          phone: cleanWalkInPhone,
          serviceIds: selectedServiceIds,
          preferredBarberId: walkInBarberId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add walk-in');
      }

      showToast(`Added walk-in: ${data.entry.token} (${data.entry.customerName})`);
      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInPhone('');
      setSelectedServiceIds([]);
      setWalkInBarberId(null);
      fetchDashboard();
    } catch (err: any) {
      setWalkInError(err.message || 'Error adding walk-in customer');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const toggleWalkInService = (id: string) => {
    setLimitWarning(false);
    if (selectedServiceIds.includes(id)) {
      setSelectedServiceIds(selectedServiceIds.filter((s) => s !== id));
    } else {
      if (selectedServiceIds.length >= 3) {
        setLimitWarning(true);
        setTimeout(() => setLimitWarning(false), 3000);
        return;
      }
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  // Format countdown string MM:SS
  const formatCountdown = (calledAtStr?: string | null) => {
    if (!calledAtStr) return { text: '00:00', isZero: true };
    const now = Date.now();
    const calledTime = new Date(calledAtStr).getTime();
    const elapsedSec = Math.floor((now - calledTime) / 1000);
    const remainingSec = Math.max(0, 600 - elapsedSec);

    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    return {
      text: `${pad(m)}:${pad(s)}`,
      isZero: remainingSec <= 0,
      remainingSec,
    };
  };

  // Lock session helper
  const handleLock = () => {
    localStorage.removeItem('salon_pin_reception');
    window.location.reload();
  };

  return (
    <PinGate
      storageKey="salon_pin_reception"
      expectedPin="1111"
      title={t('pin.receptionTitle')}
      subtitle={t('pin.receptionSubtitle')}
    >
      <div className="min-h-screen bg-charcoal-900 text-charcoal-50 flex flex-col select-none">
        {/* Top Bar for Tablet Landscape */}
        <header className="bg-charcoal-800 border-b border-charcoal-700/80 px-4 sm:px-6 py-3.5 sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Branding & Queue Count */}
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold font-bold text-lg">
                  ✂️
                </div>
                <div>
                  <h1 className="font-extrabold text-base sm:text-lg text-charcoal-50 leading-tight">
                    {t('reception.title')}
                  </h1>
                  <span className="text-[11px] font-semibold text-gold/80">
                    Tablet Landscape (10-inch)
                  </span>
                </div>
              </a>

              {/* Live Queue count badge */}
              <div className="ml-4 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold font-black text-xs sm:text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
                <span>{dashboard?.queueCount || 0} {t('reception.queueCount')}</span>
              </div>
            </div>

            {/* Actions: Add Walk-in, Language, Lock */}
            <div className="flex items-center gap-3">
              {/* Add Walk-in Button - Primary Gold CTA */}
              <button
                type="button"
                onClick={() => {
                  setShowWalkInModal(true);
                  if (services.length > 0 && selectedServiceIds.length === 0) {
                    setSelectedServiceIds([services[0].id]);
                  }
                }}
                className="btn-tap-target flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
              >
                <span>+</span> {t('reception.addWalkIn')}
              </button>

              {/* Language Toggle */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="btn-tap-target flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-charcoal-700 hover:bg-charcoal-700/80 text-charcoal-50 border border-gold/30 hover:border-gold transition-all"
                aria-label="Toggle Language"
              >
                <span className={language === 'en' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>EN</span>
                <span className="text-charcoal-700">|</span>
                <span className={language === 'gu' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>ગુજ</span>
              </button>

              {/* Lock Button */}
              <button
                type="button"
                onClick={handleLock}
                title={t('reception.lock')}
                className="btn-tap-target p-2 rounded-lg bg-charcoal-700/70 hover:bg-charcoal-700 text-charcoal-200/60 hover:text-charcoal-100 border border-charcoal-700 transition-colors"
              >
                🔒
              </button>
            </div>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-16 right-4 z-50 bg-charcoal-800 border-2 border-gold text-gold px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold animate-bounce flex items-center gap-2">
            <span>ℹ️</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Dashboard Layout (40% Left, 60% Right) */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
              <div className="lg:col-span-5 space-y-4">
                <div className="h-44 bg-charcoal-800 border border-gold/20 rounded-2xl"></div>
                <div className="h-44 bg-charcoal-800 border border-gold/20 rounded-2xl"></div>
              </div>
              <div className="lg:col-span-7">
                <div className="h-96 bg-charcoal-800 border border-gold/20 rounded-2xl"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-charcoal-800 rounded-3xl border border-red-500/30">
              <p className="text-sm text-red-300 mb-4">{error}</p>
              <button
                onClick={fetchDashboard}
                type="button"
                className="btn-tap-target px-4 py-2 bg-charcoal-700 text-gold rounded-xl font-bold text-xs"
              >
                {t('app.retry')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ======================================================== */}
              {/* LEFT COLUMN (about 40%): One card per barber */}
              {/* ======================================================== */}
              <section className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-200/70">
                    {t('reception.barbersHeading')}
                  </h2>
                  <span className="text-[11px] text-charcoal-200/50">
                    {dashboard?.barbers.length || 0} on duty
                  </span>
                </div>

                <div className="space-y-3.5">
                  {dashboard?.barbers.map((barber) => {
                    const cust = barber.currentCustomer;

                    return (
                      <div
                        key={barber.id}
                        className={`rounded-2xl p-4 border transition-all ${
                          cust
                            ? 'bg-charcoal-800/90 border-charcoal-700 shadow-md'
                            : barber.status === 'On break'
                            ? 'bg-charcoal-800/50 border-purple-500/30'
                            : 'bg-charcoal-800/70 border-emerald-500/30'
                        }`}
                      >
                        {/* Barber Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-charcoal-700/60 mb-3">
                          <div className="flex items-center gap-3">
                            <BarberAvatar name={barber.name} size="md" />
                            <div>
                              <div className="font-extrabold text-sm text-charcoal-50">{barber.name}</div>
                              <div className="text-[11px] text-charcoal-200/50">
                                {barber.isOnDuty ? 'On Duty' : 'Off Duty'}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {barber.status === 'On break' ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {t('barberStatus.onBreak')}
                              </span>
                            ) : cust ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                {t('barberStatus.busy')}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {t('barberStatus.available')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Current Customer Card or Free state */}
                        <div className="mb-3.5">
                          {cust ? (
                            <div className="bg-charcoal-900/80 rounded-xl p-3 border border-charcoal-700/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-gold font-mono">
                                    {cust.token}
                                  </span>
                                  <span className="font-bold text-xs text-charcoal-50 truncate max-w-[130px]">
                                    {cust.customerName}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    cust.status === 'In chair'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                  }`}
                                >
                                  {cust.status === 'In chair' ? 'In Chair' : 'Called'}
                                </span>
                              </div>

                              {/* Services */}
                              <div className="text-[11px] text-charcoal-200/70 truncate">
                                {cust.services.map((s) => (language === 'gu' ? s.nameGu : s.nameEn)).join(' + ')}
                              </div>

                              {/* Time info */}
                              <div className="flex items-center justify-between text-[11px] text-charcoal-200/60 pt-1 border-t border-charcoal-700/40">
                                <span>
                                  {cust.status === 'In chair' ? (
                                    <>
                                      ⏱️ {cust.elapsedMinutes} {t('reception.min')} {t('reception.elapsed')}
                                    </>
                                  ) : (
                                    <>
                                      🔔 {t('reception.calledCountdown')}: {formatCountdown(cust.calledAt).text}
                                    </>
                                  )}
                                </span>
                                <span className="font-semibold text-charcoal-200/80">
                                  {cust.status === 'In chair'
                                    ? `~${cust.remainingMinutes} ${t('reception.min')} ${t('reception.timeLeft')}`
                                    : 'Awaiting seat'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-3 px-3.5 rounded-xl bg-charcoal-900/50 border border-charcoal-700/50 text-xs text-center text-charcoal-200/50">
                              {barber.status === 'On break'
                                ? `☕ ${barber.name} ${t('status.barberOnBreak')}`
                                : `✨ ${t('reception.freeReady')}`}
                            </div>
                          )}
                        </div>

                        {/* [ Call next ] Button */}
                        <button
                          type="button"
                          onClick={() => handleCallNext(barber.id, barber.name)}
                          disabled={!barber.canCallNext}
                          className={`w-full btn-tap-target py-2.5 px-4 rounded-xl font-bold text-xs shadow transition-all ${
                            barber.canCallNext
                              ? 'bg-gold hover:bg-gold-light text-charcoal-950 active:scale-[0.98] cursor-pointer'
                              : 'bg-charcoal-700/60 text-charcoal-200/30 border border-charcoal-700/40 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {t('reception.callNext')} →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ======================================================== */}
              {/* RIGHT COLUMN (about 60%): Waiting List in Order */}
              {/* ======================================================== */}
              <section className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-200/70">
                    {t('reception.queueHeading')}
                  </h2>
                  <span className="text-[11px] font-semibold text-charcoal-200/50">
                    {dashboard?.queueList.length || 0} {t('reception.queueCount')}
                  </span>
                </div>

                {dashboard && dashboard.queueList.length === 0 ? (
                  /* Empty state */
                  <div className="bg-charcoal-800/80 border border-charcoal-700 rounded-3xl p-12 text-center shadow-lg">
                    <span className="text-4xl mb-3 block">💈</span>
                    <h3 className="text-base font-bold text-charcoal-50 mb-1">
                      {t('reception.noOneWaiting')}
                    </h3>
                    <p className="text-xs text-charcoal-200/60">
                      Walk-ins can be added using the "+ Add walk-in" button above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dashboard?.queueList.map((row) => {
                      const isCalled = row.status === 'Called';
                      const countdown = formatCountdown(row.calledAt);
                      const isOver60 = row.isOver60;

                      return (
                        <div
                          key={row.id}
                          className={`rounded-2xl p-3.5 border transition-all ${
                            isCalled
                              ? 'bg-gradient-to-r from-amber-500/15 via-charcoal-800 to-charcoal-800 border-amber-500/60 shadow-md'
                              : isOver60
                              ? 'bg-amber-950/20 border-amber-500/40 text-amber-100'
                              : 'bg-charcoal-800 border-charcoal-700/80 shadow-sm'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Left: Token, Customer Name, Services */}
                            <div className="flex items-start sm:items-center gap-3">
                              {/* Token */}
                              <div className="flex flex-col items-center justify-center min-w-[54px] p-2 rounded-xl bg-charcoal-900 border border-charcoal-700">
                                <span className="text-base font-black text-gold font-mono leading-none">
                                  {row.token}
                                </span>
                                {isCalled && (
                                  <span className="text-[9px] font-bold text-amber-400 mt-1 uppercase animate-pulse">
                                    Called
                                  </span>
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-charcoal-50">
                                    {row.customerName}
                                  </span>
                                  <span className="text-xs text-charcoal-200/50 font-mono">
                                    {row.phone}
                                  </span>
                                </div>

                                {/* Services */}
                                <div className="text-xs text-charcoal-200/70 mt-0.5">
                                  {row.services.map((s) => (language === 'gu' ? s.nameGu : s.nameEn)).join(' · ')}
                                </div>
                              </div>
                            </div>

                            {/* Center/Right: Preferred Barber, Waiting Time, Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal-700/50">
                              {/* Preferred Barber */}
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-charcoal-200/40 block">
                                  {t('status.chosenBarber')}
                                </span>
                                <span className="text-xs font-bold text-charcoal-100">
                                  {row.preferredBarber ? row.preferredBarber.name : t('reception.anyBarber')}
                                </span>
                              </div>

                              {/* Waiting time badge */}
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-charcoal-200/40 block">
                                  {t('reception.waited')}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`text-xs font-extrabold ${
                                      isOver60 ? 'text-amber-400' : 'text-charcoal-200/90'
                                    }`}
                                  >
                                    {row.waitedMinutes} {t('reception.min')}
                                  </span>
                                  {isOver60 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      {t('reception.over60Badge')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons: [ No-show ] (Called) or [ Cancel ] (Waiting) */}
                              <div className="pl-2">
                                {isCalled ? (
                                  <div className="flex items-center gap-2">
                                    {/* 10-minute countdown */}
                                    <div
                                      className={`text-xs font-mono font-bold px-2 py-1 rounded-lg border ${
                                        countdown.isZero
                                          ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-bounce'
                                          : 'bg-charcoal-900 text-gold border-charcoal-700'
                                      }`}
                                    >
                                      ⏱️ {countdown.text}
                                    </div>

                                    {/* [ No-show ] button - Turns RED at 0 */}
                                    <button
                                      type="button"
                                      onClick={() => handleMarkNoShow(row.id, row.token)}
                                      className={`btn-tap-target px-3.5 py-1.5 rounded-xl font-bold text-xs shadow transition-all ${
                                        countdown.isZero
                                          ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                                          : 'bg-charcoal-700 hover:bg-charcoal-700/80 text-amber-300 border border-amber-500/30'
                                      }`}
                                    >
                                      {t('reception.noShow')}
                                    </button>
                                  </div>
                                ) : (
                                  /* [ Cancel ] button only for Waiting rows */
                                  <button
                                    type="button"
                                    onClick={() => handleCancelSpot(row.id, row.token)}
                                    className="btn-tap-target px-3 py-1.5 rounded-xl text-xs font-semibold text-charcoal-200/60 hover:text-red-400 border border-charcoal-700 hover:border-red-500/40 transition-colors"
                                  >
                                    {t('reception.cancel')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {/* ======================================================== */}
        {/* ADD WALK-IN MODAL FORM */}
        {/* ======================================================== */}
        {showWalkInModal && (
          <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-charcoal-800 border border-charcoal-700 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-charcoal-700">
                <h3 className="font-extrabold text-base text-charcoal-50 flex items-center gap-2">
                  <span>✂️</span> {t('reception.modalWalkInTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="btn-tap-target p-1 text-charcoal-200/60 hover:text-charcoal-50"
                >
                  ✕
                </button>
              </div>

              {walkInError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs">
                  {walkInError}
                </div>
              )}

              <form onSubmit={handleWalkInSubmit} className="space-y-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-200/80 mb-1">
                    {t('reception.walkInName')} <span className="text-gold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder={t('reception.walkInNamePlaceholder')}
                    className="w-full btn-tap-target px-3.5 py-2.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-charcoal-50 text-sm focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-200/80 mb-1">
                    {t('reception.walkInPhone')} <span className="text-gold">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={walkInPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setWalkInPhone(val);
                    }}
                    onBlur={() => setWalkInPhoneTouched(true)}
                    placeholder={t('reception.walkInPhonePlaceholder')}
                    className="w-full btn-tap-target px-3.5 py-2.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-charcoal-50 text-sm focus:outline-none focus:border-gold"
                  />
                  {walkInPhoneTouched && !isWalkInPhoneValid && (
                    <p className="text-[11px] text-red-400 mt-1 font-medium">
                      {t('reception.walkInPhoneError')}
                    </p>
                  )}
                </div>

                {/* Services (multi-select, max 3) */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-200/80 mb-1.5">
                    {t('reception.walkInServices')} ({selectedServiceIds.length}/3)
                  </label>

                  {limitWarning && (
                    <p className="text-[11px] text-amber-300 mb-1.5 font-bold">
                      ⚠️ {t('reception.walkInLimitWarning')}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {services.map((srv) => {
                      const isSel = selectedServiceIds.includes(srv.id);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => toggleWalkInService(srv.id)}
                          className={`btn-tap-target p-2 rounded-xl border text-xs cursor-pointer flex flex-col justify-between ${
                            isSel
                              ? 'bg-gold/15 border-gold text-charcoal-50'
                              : 'bg-charcoal-900 border-charcoal-700 text-charcoal-200/80'
                          }`}
                        >
                          <span className="font-bold truncate">
                            {language === 'gu' ? srv.nameGu : srv.nameEn}
                          </span>
                          <span className="text-gold font-extrabold mt-1">₹{srv.price}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred Barber */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-200/80 mb-1">
                    {t('reception.walkInBarber')}
                  </label>
                  <select
                    value={walkInBarberId || ''}
                    onChange={(e) => setWalkInBarberId(e.target.value ? e.target.value : null)}
                    className="w-full btn-tap-target px-3 py-2 rounded-xl bg-charcoal-900 border border-charcoal-700 text-charcoal-50 text-xs focus:outline-none focus:border-gold"
                  >
                    <option value="">{t('join.anyBarber')}</option>
                    {dashboard?.barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.status === 'On break' ? `(${t('barberStatus.onBreak')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={!isWalkInFormValid || walkInSubmitting}
                    className={`flex-1 btn-tap-target py-2.5 px-4 rounded-xl font-bold text-xs shadow transition-all ${
                      isWalkInFormValid && !walkInSubmitting
                        ? 'bg-gold hover:bg-gold-light text-charcoal-950 cursor-pointer'
                        : 'bg-charcoal-700 text-charcoal-200/30 cursor-not-allowed border border-charcoal-700'
                    }`}
                  >
                    {walkInSubmitting ? 'Adding...' : t('reception.walkInSubmit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWalkInModal(false)}
                    className="btn-tap-target py-2.5 px-4 rounded-xl bg-charcoal-700 hover:bg-charcoal-700/80 text-charcoal-200 text-xs font-semibold border border-charcoal-700 transition-colors"
                  >
                    {t('reception.walkInCancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PinGate>
  );
};
