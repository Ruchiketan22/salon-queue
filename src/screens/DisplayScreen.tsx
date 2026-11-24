import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const DisplayScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-50 flex flex-col p-6 sm:p-10 select-none">
      <header className="flex items-center justify-between border-b border-charcoal-700 pb-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl">✂️</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gold tracking-wide">
              {t('app.title')}
            </h1>
            <p className="text-sm text-charcoal-200/60">{t('display.title')}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {t('app.openStatus')}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-charcoal-700/60 rounded-3xl p-12 text-center text-charcoal-200/50">
        <span className="text-5xl mb-4">📺</span>
        <h2 className="text-xl font-semibold text-charcoal-100 mb-2">
          1920×1080 Waiting Area TV View
        </h2>
        <p className="text-sm">Waiting Area TV view will be built in Step 5.</p>
      </main>
    </div>
  );
};
