import React from 'react';

/**
 * Komponen Tombol ramah sentuh (tinggi minimal 48px)
 * Varian: primary | secondary | danger | ghost | outlineDanger
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ariaLabel,
  ...rest
}) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-btn transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeClasses = {
    sm: 'min-h-[40px] px-3 py-2 text-sm',
    md: 'min-h-[48px] px-4 py-3 text-base',
    lg: 'min-h-[54px] px-5 py-3.5 text-lg'
  };

  const variantClasses = {
    primary:
      'bg-primary-600 hover:bg-primary-700 text-white shadow-sm',
    secondary:
      'bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800',
    danger:
      'bg-status-danger hover:bg-red-700 text-white shadow-sm',
    outlineDanger:
      'bg-white dark:bg-surface-darkCard border-2 border-red-200 dark:border-red-800/70 text-status-danger dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
    ghost:
      'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${
        variantClasses[variant] || variantClasses.primary
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

