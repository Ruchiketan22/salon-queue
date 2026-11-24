import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { socket } from '../socket';
import { Barber } from '../types';

interface QueueOverviewData {
  waitingCount: number;
  nextEstimatedWaitMinutes: number;
  isOnlineQueueOpen: boolean;
  activeBarbersCount: number;
}

export const HomeScreen: React.FC = () => {
  const { t } = useLanguage();

  const [overview, setOverview] = useState<QueueOverviewData | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, barbersRes] = await Promise.all([
        fetch('/api/queue/overview'),
        fetch('/api/barbers'),
      ]);

      if (!overviewRes.ok || !barbersRes.ok) {
        throw new Error('Failed to load queue data');
      }

      const overviewData: QueueOverviewData = await overviewRes.json();
      const barbersData: Barber[] = await barbersRes.json();

      setOverview(overviewData);
      setBarbers(barbersData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if customer has an active spot in localStorage
  useEffect(() => {
    const savedSpotId = localStorage.getItem('salon_active_token_id');
    if (savedSpotId) {
      fetch(`/api/queue/${savedSpotId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Spot not found');
        })
        .then((entry) => {
          if (['Waiting', 'Called', 'In chair'].includes(entry.status)) {
            setActiveSpotId(savedSpotId);
          } else {
            // Expired or finished spot
            localStorage.removeItem('salon_active_token_id');
            setActiveSpotId(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('salon_active_token_id');
          setActiveSpotId(null);
        });
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Live socket sync
    const onQueueUpdate = () => {
      fetchData();
    };

    socket.on('queue:updated', onQueueUpdate);
    return () => {
      socket.off('queue:updated', onQueueUpdate);
    };
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    if (status === 'Available') {
      return (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          {t('barberStatus.available')}
        </span>
      );
    }
    if (status === 'Busy') {
      return (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {t('barberStatus.busy')}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
        {t('barberStatus.onBreak')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header />

      <main className="flex-1 max-w-[390px] w-full mx-auto px-4 py-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header Status & Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💈</span>
              <h2 className="text-lg font-bold text-charcoal-50">{t('app.title')}</h2>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {overview?.isOnlineQueueOpen !== false ? t('app.openStatus') : t('app.closedStatus')}
            </div>
          </div>

          {/* Active spot banner if already in queue */}
          {activeSpotId && (
            <div className="bg-gradient-to-r from-gold/15 to-charcoal-800 border border-gold/50 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div className="flex-1 pr-3">
                <p className="text-xs text-gold font-medium">{t('home.activeSpotNotice')}</p>
                <p className="text-xs text-charcoal-200/80 mt-0.5">#{activeSpotId.slice(-4).toUpperCase()}</p>
              </div>
              <a
                href={`/status/${activeSpotId}`}
                className="btn-tap-target shrink-0 flex items-center justify-center px-4 py-2 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-xs shadow transition-all active:scale-95"
              >
                {t('home.viewMySpot')} →
              </a>
            </div>
          )}

          {/* Live Card */}
          {loading ? (
            /* Gold skeleton loading card */
            <div className="w-full bg-charcoal-800 border-2 border-gold/20 rounded-2xl p-6 shadow-xl animate-pulse">
              <div className="h-4 bg-gold/20 rounded w-1/3 mb-4"></div>
              <div className="h-8 bg-gold/15 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-charcoal-700 rounded w-1/2"></div>
            </div>
          ) : error ? (
            /* Friendly error state with retry button */
            <div className="w-full bg-charcoal-800 border border-red-500/40 rounded-2xl p-6 shadow-xl text-center">
              <p className="text-sm text-red-300 mb-4">{error}</p>
              <button
                onClick={fetchData}
                type="button"
                className="btn-tap-target px-4 py-2 rounded-xl bg-charcoal-700 text-gold border border-gold/40 hover:bg-charcoal-700/80 font-semibold text-xs transition-all"
              >
                {t('app.retry')}
              </button>
            </div>
          ) : (
            <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-60"></div>
              {overview && overview.waitingCount > 0 ? (
                <div>
                  <div className="text-3xl font-extrabold text-gold mb-1">
                    {overview.waitingCount} <span className="text-xl font-bold text-charcoal-50">{t('home.peopleWaiting')}</span>
                  </div>
                  <div className="text-sm text-charcoal-200/80 font-medium">
                    {t('home.about')} <span className="text-gold font-bold">{overview.nextEstimatedWaitMinutes}</span> {t('home.min')}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-base font-bold text-emerald-400">
                    {t('home.emptyQueue')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Barbers with live status */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-200/60 mb-3 px-1">
              {t('admin.barbers')}
            </h3>
            {loading ? (
              <div className="grid grid-cols-1 gap-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 bg-charcoal-800 border border-charcoal-700 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {barbers.map((barber) => (
                  <div
                    key={barber.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-charcoal-800 border border-charcoal-700/70 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <BarberAvatar name={barber.name} size="md" />
                      <div>
                        <div className="font-bold text-sm text-charcoal-50">{barber.name}</div>
                      </div>
                    </div>
                    <div>{getStatusBadge(barber.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="mt-8 pt-4 pb-2">
          {overview?.isOnlineQueueOpen !== false ? (
            <a
              href="/join"
              className="w-full btn-tap-target flex items-center justify-center py-4 px-6 rounded-2xl bg-gold hover:bg-gold-light text-charcoal-950 font-extrabold text-base shadow-xl hover:shadow-gold/20 transition-all active:scale-[0.99]"
            >
              {t('home.joinQueue')} →
            </a>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                disabled
                className="w-full btn-tap-target flex items-center justify-center py-4 px-6 rounded-2xl bg-charcoal-800 text-charcoal-200/40 font-bold text-base border border-charcoal-700 cursor-not-allowed opacity-60"
              >
                {t('home.joinQueue')}
              </button>
              <p className="text-xs text-amber-300/90 text-center px-2">
                {t('home.queueClosed')}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
