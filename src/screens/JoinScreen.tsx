import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { ServiceItem, Barber } from '../types';

interface QueueOverviewData {
  waitingCount: number;
  nextEstimatedWaitMinutes: number;
  isOnlineQueueOpen: boolean;
  activeBarbersCount: number;
}

export const JoinScreen: React.FC = () => {
  const { language, t } = useLanguage();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [overview, setOverview] = useState<QueueOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null); // null means 'Any barber'

  // Validation / notices
  const [limitWarning, setLimitWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyInQueueEntryId, setAlreadyInQueueEntryId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cleanPhone = useMemo(() => phone.replace(/\D/g, '').slice(0, 10), [phone]);
  const isPhoneValid = cleanPhone.length === 10;
  const isNameValid = name.trim().length > 0;
  const isFormValid = isNameValid && isPhoneValid && selectedServiceIds.length > 0;

  const fetchData = async () => {
    try {
      setFetchError(null);
      const [srvRes, barbRes, ovRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/barbers'),
        fetch('/api/queue/overview'),
      ]);

      if (!srvRes.ok || !barbRes.ok || !ovRes.ok) {
        throw new Error('Failed to load services or barbers');
      }

      const srvData: ServiceItem[] = await srvRes.json();
      const barbData: Barber[] = await barbRes.json();
      const ovData: QueueOverviewData = await ovRes.json();

      setServices(srvData);
      setBarbers(barbData);
      setOverview(ovData);

      // Pre-select first service if available for faster user experience
      if (srvData.length > 0 && selectedServiceIds.length === 0) {
        setSelectedServiceIds([srvData[0].id]);
      }
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleService = (serviceId: string) => {
    setLimitWarning(false);
    if (selectedServiceIds.includes(serviceId)) {
      setSelectedServiceIds(selectedServiceIds.filter((id) => id !== serviceId));
    } else {
      if (selectedServiceIds.length >= 3) {
        setLimitWarning(true);
        setTimeout(() => setLimitWarning(false), 3500);
        return;
      }
      setSelectedServiceIds([...selectedServiceIds, serviceId]);
    }
  };

  // Calculations for live summary bar
  const totalDuration = useMemo(() => {
    return selectedServiceIds.reduce((sum, id) => {
      const s = services.find((srv) => srv.id === id);
      return sum + (s?.durationMinutes || 0);
    }, 0);
  }, [selectedServiceIds, services]);

  const totalPrice = useMemo(() => {
    return selectedServiceIds.reduce((sum, id) => {
      const s = services.find((srv) => srv.id === id);
      return sum + (s?.price || 0);
    }, 0);
  }, [selectedServiceIds, services]);

  const expectedWaitMinutes = useMemo(() => {
    return overview ? overview.nextEstimatedWaitMinutes : 0;
  }, [overview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    try {
      setSubmitting(true);
      setSubmitError(null);
      setAlreadyInQueueEntryId(null);

      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: cleanPhone,
          serviceIds: selectedServiceIds,
          preferredBarberId: selectedBarberId,
        }),
      });

      const data = await res.json();

      if (res.status === 409 || data.code === 'ALREADY_IN_QUEUE') {
        setAlreadyInQueueEntryId(data.entryId);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to join queue');
      }

      // Save active spot to localStorage
      localStorage.setItem('salon_active_token_id', data.entry.id);

      // Redirect to status page
      window.location.href = `/status/${data.entry.id}`;
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'Error joining queue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col pb-32">
      <Header showBackHome />

      <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-5">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-charcoal-50 mb-1">
            {t('join.title')}
          </h2>
          <p className="text-xs text-charcoal-200/70">
            {t('join.subtitle')}
          </p>
        </div>

        {/* Existing spot alert */}
        {alreadyInQueueEntryId && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-charcoal-50 space-y-2">
            <p className="text-sm font-semibold text-amber-300">
              ⚠️ {t('join.alreadyInQueue')}
            </p>
            <a
              href={`/status/${alreadyInQueueEntryId}`}
              className="btn-tap-target inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gold text-charcoal-950 font-bold text-xs shadow hover:bg-gold-light transition-all"
            >
              {t('join.viewActiveSpot')} →
            </a>
          </div>
        )}

        {submitError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs">
            {submitError}
          </div>
        )}

        {loading ? (
          /* Gold Skeleton Cards */
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-charcoal-800 border-2 border-gold/20 rounded-2xl p-4"></div>
            <div className="h-40 bg-charcoal-800 border-2 border-gold/20 rounded-2xl p-4"></div>
            <div className="h-28 bg-charcoal-800 border-2 border-gold/20 rounded-2xl p-4"></div>
          </div>
        ) : fetchError ? (
          <div className="bg-charcoal-800 border border-red-500/40 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-300 mb-4">{fetchError}</p>
            <button
              onClick={fetchData}
              type="button"
              className="btn-tap-target px-4 py-2 rounded-xl bg-charcoal-700 text-gold border border-gold/40 hover:bg-charcoal-700/80 font-semibold text-xs"
            >
              {t('app.retry')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Details */}
            <div className="space-y-4 bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 shadow-sm">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-200/90 mb-1.5">
                  {t('join.name')} <span className="text-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('join.namePlaceholder')}
                  className="w-full btn-tap-target px-3.5 py-2.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-charcoal-50 text-sm placeholder:text-charcoal-200/40 focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              {/* Phone with 10-digit validation */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-200/90 mb-1.5">
                  {t('join.phone')} <span className="text-gold">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(val);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder={t('join.phonePlaceholder')}
                  className={`w-full btn-tap-target px-3.5 py-2.5 rounded-xl bg-charcoal-900 border text-charcoal-50 text-sm placeholder:text-charcoal-200/40 focus:outline-none transition-colors ${
                    phoneTouched && !isPhoneValid
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-charcoal-700 focus:border-gold'
                  }`}
                />
                {phoneTouched && !isPhoneValid && (
                  <p className="text-[11px] text-red-400 mt-1 font-medium">
                    {t('join.phoneError')}
                  </p>
                )}
              </div>
            </div>

            {/* Service Cards (Multi-select, Max 3) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-200/70">
                  {t('join.services')} <span className="text-gold">({selectedServiceIds.length}/3)</span>
                </label>
              </div>

              {/* 4th service limit warning */}
              {limitWarning && (
                <div className="mb-2 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
                  <span>⚠️</span> {t('join.servicesLimit')}
                </div>
              )}

              <div className="space-y-2">
                {services.map((service) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  const displayName = language === 'gu' ? service.nameGu : service.nameEn;

                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`btn-tap-target cursor-pointer flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-gold/10 border-gold shadow-sm'
                          : 'bg-charcoal-800 border-charcoal-700/80 hover:border-charcoal-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-gold border-gold text-charcoal-950 font-bold text-xs'
                              : 'border-charcoal-700 bg-charcoal-900'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-charcoal-50">{displayName}</p>
                          <p className="text-xs text-charcoal-200/60">
                            {service.durationMinutes} {t('join.summaryMin')}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-extrabold text-gold">
                        ₹{service.price}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Barber Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-200/70 mb-2">
                {t('join.barber')}
              </label>

              <div className="space-y-2">
                {/* Any barber (fastest) */}
                <div
                  onClick={() => setSelectedBarberId(null)}
                  className={`btn-tap-target cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedBarberId === null
                      ? 'bg-gold/10 border-gold'
                      : 'bg-charcoal-800 border-charcoal-700/80 hover:border-charcoal-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold text-lg font-bold">
                      ⚡
                    </div>
                    <div>
                      <p className="font-bold text-sm text-charcoal-50">{t('join.anyBarber')}</p>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedBarberId === null ? 'border-gold bg-gold' : 'border-charcoal-700'
                    }`}
                  >
                    {selectedBarberId === null && <div className="w-1.5 h-1.5 rounded-full bg-charcoal-950"></div>}
                  </div>
                </div>

                {/* Specific Barbers */}
                {barbers.map((barber) => {
                  const isSelected = selectedBarberId === barber.id;
                  const isOnBreak = barber.status === 'On break';

                  return (
                    <div
                      key={barber.id}
                      onClick={() => setSelectedBarberId(barber.id)}
                      className={`btn-tap-target cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-gold/10 border-gold'
                          : 'bg-charcoal-800 border-charcoal-700/80 hover:border-charcoal-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <BarberAvatar name={barber.name} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-charcoal-50">{barber.name}</span>
                            {isOnBreak && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {t('join.onBreakTag')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-gold bg-gold' : 'border-charcoal-700'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-charcoal-950"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        )}
      </main>

      {/* Floating Sticky Live Summary Bar + Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-charcoal-800/95 backdrop-blur-md border-t border-charcoal-700 px-4 py-3 z-40">
        <div className="max-w-[390px] mx-auto space-y-2.5">
          {/* Live Summary Bar: Total 45 min · ₹230 · Expected wait ~35 min */}
          <div className="flex items-center justify-between text-xs text-charcoal-200/90 font-medium px-1">
            <span>
              {t('join.summaryTotal')} <strong className="text-charcoal-50">{totalDuration} {t('join.summaryMin')}</strong>
            </span>
            <span>·</span>
            <span className="text-gold font-extrabold text-sm">
              ₹{totalPrice}
            </span>
            <span>·</span>
            <span>
              {t('join.summaryExpectedWait')} ~<strong className="text-gold">{expectedWaitMinutes} {t('join.summaryMin')}</strong>
            </span>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
            className={`w-full btn-tap-target flex items-center justify-center py-3.5 px-6 rounded-2xl font-extrabold text-sm shadow-xl transition-all ${
              isFormValid && !submitting
                ? 'bg-gold hover:bg-gold-light text-charcoal-950 active:scale-[0.99] cursor-pointer'
                : 'bg-charcoal-700 text-charcoal-200/40 cursor-not-allowed border border-charcoal-700'
            }`}
          >
            {submitting ? t('join.joining') : t('join.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
