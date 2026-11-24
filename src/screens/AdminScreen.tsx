import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { PinGate } from '../components/PinGate';
import { BarberAvatar } from '../components/BarberAvatar';
import { useLanguage } from '../context/LanguageContext';
import { socket } from '../socket';
import { apiUrl } from '../apiBase';

interface AdminService {
  id: string;
  nameEn: string;
  nameGu: string;
  durationMinutes: number;
  price: number;
  isActive: number | boolean;
}

interface AdminBarber {
  id: string;
  name: string;
  status: string;
  isOnDuty: number | boolean;
}

interface AdminData {
  services: AdminService[];
  barbers: AdminBarber[];
  isOnlineQueueOpen: boolean;
  todayStats: { served: number; avgWaitMinutes: number | null; noShows: number };
}

interface ServiceForm {
  nameEn: string;
  nameGu: string;
  durationMinutes: string;
  price: string;
}

const emptyForm: ServiceForm = { nameEn: '', nameGu: '', durationMinutes: '', price: '' };

const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className={`btn-tap-target relative w-14 h-8 rounded-full transition-colors shrink-0 ${
      on ? 'bg-emerald-600' : 'bg-charcoal-700'
    }`}
  >
    <span
      className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

const AdminContent: React.FC = () => {
  const { language, t } = useLanguage();
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/dashboard'));
      if (!res.ok) throw new Error('Failed to load settings');
      setData(await res.json());
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Error connecting to server');
    }
  }, []);

  useEffect(() => {
    load();
    socket.on('queue:updated', load);
    return () => {
      socket.off('queue:updated', load);
    };
  }, [load]);

  const call = async (url: string, method: string, body?: unknown) => {
    try {
      setActionError(null);
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || 'Action failed');
      }
      await load();
      return true;
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
      return false;
    }
  };

  const startEdit = (s: AdminService) => {
    setAdding(false);
    setEditingId(s.id);
    setForm({
      nameEn: s.nameEn,
      nameGu: s.nameGu,
      durationMinutes: String(s.durationMinutes),
      price: String(s.price),
    });
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setForm(emptyForm);
  };

  const closeForm = () => {
    setEditingId(null);
    setAdding(false);
    setForm(emptyForm);
  };

  const saveForm = async () => {
    const body = {
      nameEn: form.nameEn,
      nameGu: form.nameGu,
      durationMinutes: form.durationMinutes,
      price: form.price,
    };
    const ok = adding
      ? await call('/api/admin/services', 'POST', body)
      : await call(`/api/admin/services/${editingId}`, 'PATCH', body);
    if (ok) closeForm();
  };

  const lock = () => {
    localStorage.removeItem('salon_pin_admin');
    window.location.reload();
  };

  const inputCls =
    'w-full btn-tap-target px-3 py-2 rounded-xl bg-charcoal-900 border border-charcoal-700 text-charcoal-50 text-sm focus:outline-none focus:border-gold';

  const renderForm = () => (
    <div className="bg-charcoal-900 border border-gold/40 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder={t('admin.colServiceNameEn')}
          value={form.nameEn}
          onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder={t('admin.colServiceNameGu')}
          value={form.nameGu}
          onChange={(e) => setForm({ ...form, nameGu: e.target.value })}
        />
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder={t('admin.colDuration')}
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value.replace(/\D/g, '') })}
        />
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder={t('admin.colPrice')}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={saveForm}
          className="btn-tap-target px-5 py-2 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-sm"
        >
          {t('admin.saveService')}
        </button>
        <button
          type="button"
          onClick={closeForm}
          className="btn-tap-target px-5 py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-50 font-bold text-sm"
        >
          {t('admin.cancelEdit')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal-900 text-charcoal-50 flex flex-col">
      <Header showBackHome />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('admin.title')}</h2>
          <button
            type="button"
            onClick={lock}
            className="btn-tap-target px-4 py-2 rounded-xl bg-charcoal-800 border border-charcoal-700 text-xs font-bold hover:bg-charcoal-700"
          >
            🔒 {t('admin.lock')}
          </button>
        </div>

        {actionError && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs">
            {actionError}
          </div>
        )}

        {!data && !loadError && (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-charcoal-800 border-2 border-gold/20 rounded-2xl" />
            <div className="h-48 bg-charcoal-800 border-2 border-gold/20 rounded-2xl" />
          </div>
        )}

        {loadError && (
          <div className="bg-charcoal-800 border border-red-500/40 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-300 mb-4">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="btn-tap-target px-5 py-2 rounded-xl bg-gold text-charcoal-950 font-bold text-sm"
            >
              {t('app.retry')}
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Today's stats */}
            <section>
              <h3 className="text-lg font-bold mb-3">{t('admin.todayStats')}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-bold text-gold">{data.todayStats.served}</div>
                  <div className="text-xs text-charcoal-200/60 mt-1">{t('admin.statsServed')}</div>
                </div>
                <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-bold text-gold">
                    {data.todayStats.avgWaitMinutes === null
                      ? t('admin.statsNa')
                      : `${data.todayStats.avgWaitMinutes} ${t('admin.statsMin')}`}
                  </div>
                  <div className="text-xs text-charcoal-200/60 mt-1">{t('admin.statsAvgWait')}</div>
                </div>
                <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-bold text-gold">{data.todayStats.noShows}</div>
                  <div className="text-xs text-charcoal-200/60 mt-1">{t('admin.statsNoShows')}</div>
                </div>
              </div>
            </section>

            {/* Online queue switch */}
            <section className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">{t('admin.onlineQueue')}</h3>
                <p className={`text-xs mt-1 ${data.isOnlineQueueOpen ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {data.isOnlineQueueOpen ? t('admin.onlineQueueOpen') : t('admin.onlineQueueClosed')}
                </p>
              </div>
              <Toggle
                on={data.isOnlineQueueOpen}
                label={t('admin.onlineQueue')}
                onClick={() => call('/api/admin/queue-open', 'POST', { open: !data.isOnlineQueueOpen })}
              />
            </section>

            {/* Barbers on duty */}
            <section className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4">
              <h3 className="text-lg font-bold">{t('admin.barbers')}</h3>
              <p className="text-xs text-charcoal-200/60 mb-3">{t('admin.barbersSubtitle')}</p>
              <div className="space-y-2">
                {data.barbers.map((b) => {
                  const on = !!b.isOnDuty;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 bg-charcoal-900 border border-charcoal-700/80 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <BarberAvatar name={b.name} />
                        <div>
                          <div className="font-bold text-sm">{b.name}</div>
                          <div className={`text-xs ${on ? 'text-emerald-300' : 'text-charcoal-200/50'}`}>
                            {on ? t('admin.onDuty') : t('admin.offDuty')}
                          </div>
                        </div>
                      </div>
                      <Toggle
                        on={on}
                        label={b.name}
                        onClick={() => call(`/api/admin/barbers/${b.id}/toggle-duty`, 'POST')}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Services */}
            <section className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold">{t('admin.services')}</h3>
                  <p className="text-xs text-charcoal-200/60">{t('admin.servicesSubtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={startAdd}
                  className="btn-tap-target px-4 py-2 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-xs shrink-0"
                >
                  {t('admin.addService')}
                </button>
              </div>

              {adding && <div className="mb-3">{renderForm()}</div>}

              <div className="space-y-2">
                {data.services.map((s) => {
                  const on = !!s.isActive;
                  if (editingId === s.id) {
                    return <div key={s.id}>{renderForm()}</div>;
                  }
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-3 bg-charcoal-900 border border-charcoal-700/80 rounded-xl px-3 py-2 ${
                        on ? '' : 'opacity-60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">
                          {language === 'gu' ? s.nameGu : s.nameEn}
                        </div>
                        <div className="text-xs text-charcoal-200/60 truncate">
                          {language === 'gu' ? s.nameEn : s.nameGu} · {s.durationMinutes} {t('admin.statsMin')} · ₹{s.price}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="btn-tap-target px-3 py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 text-xs font-bold"
                        >
                          {t('admin.editService')}
                        </button>
                        <Toggle
                          on={on}
                          label={s.nameEn}
                          onClick={() => call(`/api/admin/services/${s.id}/toggle`, 'POST')}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export const AdminScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <PinGate
      storageKey="salon_pin_admin"
      expectedPin="3333"
      title={t('admin.pinTitle')}
      subtitle={t('admin.pinSubtitle')}
    >
      <AdminContent />
    </PinGate>
  );
};
