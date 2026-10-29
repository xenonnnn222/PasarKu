import React, { useContext, createContext } from 'react';
import Topbar from './Topbar';

export const LayoutContext = createContext({
  openMobileMenu: () => {}
});

/**
 * Wrapper halaman utama Desktop-First dengan Topbar dan container maksimal 1280px
 */
export default function PageContainer({
  title,
  subtitle,
  showBack = false,
  rightAction,
  children,
  className = ''
}) {
  const { openMobileMenu } = useContext(LayoutContext);

  return (
    <div className="min-h-screen flex flex-col animate-page">
      <Topbar
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        rightAction={rightAction}
        onOpenMobileMenu={openMobileMenu}
      />
      <main
        className={`flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}
      >
        {children}
      </main>
    </div>
  );
}
