import React, { useState, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { JoinScreen } from './screens/JoinScreen';
import { StatusScreen } from './screens/StatusScreen';
import { ReceptionScreen } from './screens/ReceptionScreen';
import { BarberScreen } from './screens/BarberScreen';
import { DisplayScreen } from './screens/DisplayScreen';
import { AdminScreen } from './screens/AdminScreen';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const onLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  // Simple router for 7 screens
  if (currentPath === '/' || currentPath === '') {
    return <HomeScreen />;
  }

  if (currentPath === '/join') {
    return <JoinScreen />;
  }

  if (currentPath.startsWith('/status/')) {
    const id = currentPath.replace('/status/', '').split('/')[0];
    return <StatusScreen id={id} />;
  }

  if (currentPath === '/reception') {
    return <ReceptionScreen />;
  }

  if (currentPath.startsWith('/barber/')) {
    const name = decodeURIComponent(currentPath.replace('/barber/', '').split('/')[0]);
    return <BarberScreen name={name} />;
  }

  if (currentPath === '/display') {
    return <DisplayScreen />;
  }

  if (currentPath === '/admin') {
    return <AdminScreen />;
  }

  // Fallback 404
  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col items-center justify-center p-4 text-center">
      <div className="text-4xl mb-3">💈</div>
      <h1 className="text-2xl font-bold text-charcoal-50 mb-2">Page Not Found</h1>
      <p className="text-sm text-charcoal-200/60 mb-6">The requested path does not exist.</p>
      <a
        href="/"
        className="btn-tap-target px-5 py-2.5 rounded-xl bg-gold text-charcoal-950 font-bold text-sm shadow hover:bg-gold-light transition-all flex items-center justify-center"
      >
        Back to Home
      </a>
    </div>
  );
};

export default App;
