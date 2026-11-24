import React from 'react';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

interface BarberScreenProps {
  name?: string;
}

export const BarberScreen: React.FC<BarberScreenProps> = ({ name }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <Header showBackHome />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-charcoal-50 capitalize">
            {name ? `${name} - ${t('barber.title')}` : t('barber.title')}
          </h2>
          <span className="text-xs px-2.5 py-1 rounded bg-charcoal-700 text-gold border border-gold/30">
            Mobile
          </span>
        </div>

        <div className="bg-charcoal-800 border border-charcoal-700/80 rounded-2xl p-6 text-center text-charcoal-200/60">
          <p className="text-sm">Barber view will be built in Step 5.</p>
        </div>
      </main>
    </div>
  );
};
