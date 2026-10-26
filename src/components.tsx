import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[filter,background-color,border-color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm',
      variant === 'primary' && 'bg-brand text-ink-950 font-semibold shadow-glow hover:brightness-105',
      variant === 'secondary' && 'border border-line bg-ink-800/80 text-text hover:border-line-bright hover:bg-ink-700',
      variant === 'ghost' && 'text-dim hover:bg-ink-800 hover:text-text',
      variant === 'danger' && 'border border-line-bright bg-ink-800 text-text hover:border-line-bright hover:bg-ink-700',
      className,
    )}
  >
    {loading ? <Spinner /> : icon}
    {children}
  </button>
);

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cx('size-3.5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Panel: React.FC<{ children: ReactNode; className?: string; title?: string; hint?: ReactNode; action?: ReactNode }> = ({
  children,
  className,
  title,
  hint,
  action,
}) => (
  <section className={cx('rounded-xl border border-line bg-ink-900/70 shadow-panel backdrop-blur-sm', className)}>
    {title ? (
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide text-text uppercase">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-dim">{hint}</p> : null}
        </div>
        {action}
      </header>
    ) : null}
    <div className="p-4">{children}</div>
  </section>
);

export const Label: React.FC<{ children: ReactNode; hint?: string; htmlFor?: string }> = ({ children, hint, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold tracking-[0.12em] text-dim uppercase"
  >
    <span className="whitespace-nowrap">{children}</span>
    {hint ? <span className="shrink-0 font-normal tracking-normal normal-case text-dim/70">{hint}</span> : null}
  </label>
);

const fieldClass =
  'w-full rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-text placeholder:text-dim/60 outline-none transition-colors focus:border-brand-2 focus:ring-2 focus:ring-brand/25';

export const TextInput: React.FC<InputHTMLAttributes<HTMLInputElement>> = ({ className, ...rest }) => (
  <input {...rest} className={cx(fieldClass, className)} />
);

export const TextArea: React.FC<TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cx(fieldClass, 'resize-y leading-relaxed', className)} />
);

export const Select: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select
    {...rest}
    className={cx(fieldClass, 'appearance-none bg-ink-950/60 bg-no-repeat pr-9', className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b96b2' stroke-width='2' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
      backgroundPosition: 'right 10px center',
      ...rest.style,
    }}
  >
    {children}
  </select>
);

export const Badge: React.FC<{ children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'warn' }> = ({ children, tone = 'neutral' }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase',
      tone === 'neutral' && 'border-line bg-ink-800/60 text-dim',
      tone === 'accent' && 'border-brand/40 bg-brand/15 text-brand-soft',
      tone === 'ok' && 'border-brand/60 bg-brand/20 text-brand-soft',
      tone === 'warn' && 'border-line-bright/60 bg-ink-800 text-text',
    )}
  >
    {children}
  </span>
);

export const Notice: React.FC<{ kind?: 'info' | 'error' | 'ok'; children: ReactNode; onClose?: () => void }> = ({
  kind = 'info',
  children,
  onClose,
}) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    className={cx(
      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed',
      kind === 'info' && 'border-brand/30 bg-brand/10 text-brand-soft',
      kind === 'ok' && 'border-brand/60 bg-brand/20 text-brand-soft',
      kind === 'error' && 'border-line-bright bg-ink-800 text-text',
    )}
  >
    <div className="flex-1">{children}</div>
    {onClose ? (
      <button onClick={onClose} className="text-current/60 hover:text-current" aria-label="Dismiss">
        ✕
      </button>
    ) : null}
  </div>
);

const paths = {
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z',
  play: 'M8 5v14l11-7L8 5z',
  download: 'M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16',
  settings: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  film: 'M4 4h16v16H4V4zm0 5h16M4 15h16M9 4v16M15 4v16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  up: 'M12 19V5m0 0l-6 6m6-6l6 6',
  down: 'M12 5v14m0 0l6-6m-6 6l-6-6',
  mic: 'M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm7-3a7 7 0 01-14 0M12 19v3',
  external: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  check: 'M5 13l4 4L19 7',
  copy: 'M9 9h11v11H9V9zM5 15H4V4h11v1',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
  clock: 'M12 8v4l2.5 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  layers: 'm12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  chevron: 'm9 18 6-6-6-6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z',
  user: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z',
};

export const Icon: React.FC<{ name: keyof typeof paths; className?: string }> = ({ name, className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={cx('size-4 shrink-0', className)} aria-hidden>
    <path d={paths[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
