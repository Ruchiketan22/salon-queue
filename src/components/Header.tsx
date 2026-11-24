import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  showBackHome?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ showBackHome }) => {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="w-full bg-charcoal-800 border-b border-charcoal-700/80 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-bold text-lg group-hover:scale-105 transition-transform">
              ✂️
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-charcoal-50 leading-tight">
                {t('app.title')}
              </h1>
              <p className="text-xs text-charcoal-200/60 hidden sm:block">
                {t('app.tagline')}
              </p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-3">
          {showBackHome && (
            <a
              href="/"
              className="text-xs text-charcoal-200 hover:text-gold transition-colors py-2 px-2.5 rounded-lg border border-charcoal-700 hover:border-gold/40 btn-tap-target flex items-center"
            >
              ← {t('app.backHome')}
            </a>
          )}
          
          {/* Language Toggle EN | ગુજ - min 44px tap target */}
          <button
            onClick={toggleLanguage}
            type="button"
            className="btn-tap-target flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-charcoal-700 hover:bg-charcoal-700/80 text-charcoal-50 border border-gold/30 hover:border-gold transition-all"
            aria-label="Toggle Language"
          >
            <span className={language === 'en' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>EN</span>
            <span className="text-charcoal-700">|</span>
            <span className={language === 'gu' ? 'text-gold font-bold' : 'text-charcoal-200/60'}>ગુજ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
