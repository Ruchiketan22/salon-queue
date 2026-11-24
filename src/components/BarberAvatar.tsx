import React from 'react';

interface BarberAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BarberAvatar: React.FC<BarberAvatarProps> = ({ name, size = 'md', className = '' }) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs font-semibold',
    md: 'w-10 h-10 text-sm font-bold',
    lg: 'w-14 h-14 text-xl font-bold',
  }[size];

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-charcoal-700 to-charcoal-900 border border-gold/40 text-gold flex items-center justify-center shadow-inner select-none ${sizeClasses} ${className}`}
      aria-label={name}
    >
      <span>{initial}</span>
    </div>
  );
};
