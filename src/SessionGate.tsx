import { useEffect, useState, type ReactNode } from 'react';
import { api } from './lib/api';
import { Button, Icon, Notice, TextInput } from './components';

export const SessionGate = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const check = () =>
    api
      .session()
      .then((session) => {
        setAuthenticated(session.authenticated);
        setError('');
      })
      .catch(() => setError('Could not connect to the studio. Check the server and retry.'));
  useEffect(() => {
    void check();
    const expired = () => setAuthenticated(false);
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  if (authenticated) return children;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-5">
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink-900 p-8 shadow-panel">
        <Icon name="bolt" className="mb-8 size-10" />
        <p className="mb-2 text-xs tracking-widest text-dim uppercase">MotionForge Studio</p>
        <h1 className="text-3xl font-bold tracking-tight">Ideas deserve motion.</h1>
        <p className="mt-3 mb-7 text-sm leading-relaxed text-dim">
          Unlock your private workspace to create, edit, and export.
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        {authenticated === null ? (
          <Button className="mt-4 w-full" onClick={() => void check()}>
            Connect to studio
          </Button>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api.login(password);
                setPassword('');
                setAuthenticated(true);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <TextInput
              aria-label="Workspace password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              placeholder="Workspace password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={busy}
              icon={<Icon name="arrow" />}
            >
              Enter workspace
            </Button>
          </form>
        )}
      </div>
    </main>
  );
};
