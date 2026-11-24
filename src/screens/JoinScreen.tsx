import React from 'react';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

export const JoinScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header showBackHome />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-charcoal-50 mb-1">
            {t('join.title')}
          </h2>
          <p className="text-sm text-charcoal-200/70">
            {t('join.subtitle')}
          </p>
        </div>

        <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-5 shadow-lg text-center text-charcoal-200/60">
          <p className="text-sm">Join queue form will be built in Step 2.</p>
        </div>
      </main>
    </div>
  );
};
