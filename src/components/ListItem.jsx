import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Komponen baris daftar serbaguna dengan ikon kiri, judul, subjudul, dan nilai kanan
 */
export default function ListItem({
  title,
  subtitle,
  icon: Icon,
  iconBg = 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  rightContent,
  showArrow = false,
  onClick,
  className = ''
}) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 py-3 px-3 rounded-btn text-left transition-colors ${
        onClick
          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
          : ''
      } ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
            {title}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightContent}
        {showArrow && <ChevronRight className="w-5 h-5 text-gray-400" />}
      </div>
    </Wrapper>
  );
}

