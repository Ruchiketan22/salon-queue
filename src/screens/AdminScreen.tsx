import React from 'react';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

export const AdminScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header showBackHome />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-charcoal-50">
            {t('admin.title')}
          </h2>
          <span className="text-xs px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Owner Access
          </span>
        </div>

        <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-8 text-center text-charcoal-200/60">
          <p className="text-sm">Owner settings & stats will be built in Step 6.</p>
        </div>
      </main>
    </div>
  );
};
