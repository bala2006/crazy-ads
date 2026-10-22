import React, { useEffect, useState } from 'react';
import { SettingsPage } from './SettingsPage';
import { Studio } from './Studio';
import { cx } from './components';

const readRoute = () => (window.location.hash.replace(/^#\/?/, '') || 'studio').split('?')[0] ?? 'studio';

const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={cx('size-7', className)} aria-hidden>
    <rect x="12" y="28" width="10" height="24" rx="4" fill="#7c5cff" />
    <rect x="27" y="16" width="10" height="36" rx="4" fill="#22e6ff" />
    <rect x="42" y="34" width="10" height="18" rx="4" fill="#ff2bd6" />
  </svg>
);

export default function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const isSettings = route === 'settings';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-4 py-3">
          <a href="#/studio" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight">
              Motion<span className="text-brand-soft">Forge</span>
            </span>
          </a>

          <nav className="ml-2 flex items-center gap-1 rounded-lg border border-line bg-ink-900/80 p-1">
            <a
              href="#/studio"
              className={cx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                isSettings ? 'text-dim hover:text-text' : 'bg-ink-700 text-text shadow-sm',
              )}
            >
              Studio
            </a>
            <a
              href="#/settings"
              className={cx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                isSettings ? 'bg-ink-700 text-text shadow-sm' : 'text-dim hover:text-text',
              )}
            >
              Settings
            </a>
          </nav>

          <div className="ml-auto hidden items-center gap-2 text-[11px] text-dim sm:flex">
            <span className="rounded-full border border-line px-2 py-1">Remotion 4</span>
            <span className="rounded-full border border-line px-2 py-1">Self-hosted</span>
          </div>
        </div>
      </header>

      {isSettings ? <SettingsPage /> : <Studio />}
    </div>
  );
}
