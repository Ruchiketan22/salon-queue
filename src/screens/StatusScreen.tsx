import React from 'react';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

interface StatusScreenProps {
  id?: string;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({ id }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header showBackHome />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold text-charcoal-50 mb-2">
          {t('status.title')} {id ? `(#${id})` : ''}
        </h2>
        <div className="w-full bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-6 mt-4 shadow-xl text-charcoal-200/60">
          <p className="text-sm">Live status tracking will be built in Step 3.</p>
        </div>
      </main>
    </div>
  );
};
