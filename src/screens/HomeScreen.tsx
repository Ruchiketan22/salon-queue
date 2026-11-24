import React from 'react';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

export const HomeScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/40 flex items-center justify-center text-3xl mb-4 text-gold">
          💈
        </div>
        <h2 className="text-2xl font-bold text-charcoal-50 mb-2">
          {t('home.title')}
        </h2>
        <p className="text-sm text-charcoal-200/70 mb-8">
          {t('home.subtitle')}
        </p>

        <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-6 shadow-xl mb-6">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            {t('app.openStatus')}
          </div>
          <p className="text-sm text-charcoal-200/80">
            {t('home.emptyQueue')}
          </p>
        </div>

        <a
          href="/join"
          className="w-full btn-tap-target flex items-center justify-center py-3.5 px-6 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-base shadow-lg hover:shadow-gold/20 transition-all active:scale-[0.99]"
        >
          {t('home.joinQueue')}
        </a>
      </main>
    </div>
  );
};
