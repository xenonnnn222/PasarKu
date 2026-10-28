import React from 'react';

/**
 * Komponen Kartu standar dengan radius 16px, padding 16px, dan border halus
 */
export default function Card({ children, className = '', onClick, as = 'div' }) {
  const Component = as;
  return (
    <Component
      onClick={onClick}
      className={`bg-surface-card dark:bg-surface-darkCard rounded-card p-4 border border-[#E5E7EB] dark:border-gray-800 shadow-soft ${
        onClick
          ? 'cursor-pointer active:scale-[0.99] transition-transform'
          : ''
      } ${className}`}
    >
      {children}
    </Component>
  );
}

