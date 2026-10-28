import React from 'react';

/**
 * Komponen Input Form dengan dukungan pemformatan nominal Rupiah otomatis (formatCurrency)
 */
export default function Input({
  label,
  id,
  error,
  helperText,
  prefix,
  suffix,
  formatCurrency = false,
  value,
  onChange,
  className = '',
  ...props
}) {
  const inputId = id || `input-${label?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Jika formatCurrency aktif, tampilkan nilai ribuan dengan titik (contoh: 25.000)
  const displayValue = React.useMemo(() => {
    if (!formatCurrency) return value;
    const rawDigits = String(value ?? '').replace(/\D/g, '');
    if (!rawDigits) return '';
    return Number(rawDigits)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }, [formatCurrency, value]);

  const handleInputChange = (e) => {
    if (!onChange) return;
    if (!formatCurrency) {
      onChange(e);
      return;
    }
    const rawDigits = e.target.value.replace(/\D/g, '');
    onChange({
      ...e,
      target: {
        ...e.target,
        value: rawDigits
      }
    });
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3.5 text-gray-500 dark:text-gray-400 font-semibold select-none">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          value={displayValue}
          onChange={handleInputChange}
          className={`w-full min-h-[48px] rounded-btn border bg-white dark:bg-surface-dark px-3.5 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
            formatCurrency ? 'tabular-nums font-semibold' : ''
          } ${prefix ? 'pl-11' : ''} ${suffix ? 'pr-12' : ''} ${
            error
              ? 'border-status-danger focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-700 focus:border-primary-600 focus:ring-primary-500'
          }`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3.5 text-sm text-gray-500 dark:text-gray-400 select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-status-danger">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
