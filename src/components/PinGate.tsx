import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Header } from './Header';

interface PinGateProps {
  storageKey: string;
  expectedPin: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const PinGate: React.FC<PinGateProps> = ({
  storageKey,
  expectedPin,
  title,
  subtitle,
  children,
}) => {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem(storageKey) === expectedPin;
  });

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.trim() === expectedPin) {
      localStorage.setItem(storageKey, expectedPin);
      setIsUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col justify-between">
      <Header showBackHome />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-charcoal-800 border border-charcoal-700/90 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center text-3xl mx-auto text-gold">
            🔒
          </div>

          <div>
            <h2 className="text-xl font-bold text-charcoal-50 mb-1">{title}</h2>
            <p className="text-xs text-charcoal-200/60">{subtitle}</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder={t('pin.pinPlaceholder')}
                autoFocus
                className={`w-full tracking-widest text-center text-2xl font-bold btn-tap-target py-3 px-4 rounded-xl bg-charcoal-900 border text-gold placeholder:text-charcoal-200/30 focus:outline-none transition-colors ${
                  error ? 'border-red-500/80 focus:border-red-500' : 'border-charcoal-700 focus:border-gold'
                }`}
              />
              {error && (
                <p className="text-xs text-red-400 mt-2 font-medium">
                  {t('pin.invalidPin')}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full btn-tap-target py-3 px-6 rounded-xl bg-gold hover:bg-gold-light text-charcoal-950 font-bold text-sm shadow-lg hover:shadow-gold/20 transition-all active:scale-[0.99]"
            >
              {t('pin.submit')}
            </button>
          </form>
        </div>
      </main>

      <div className="p-4 text-center text-xs text-charcoal-200/40">
        Staff Only · Salon Queue Management
      </div>
    </div>
  );
};
