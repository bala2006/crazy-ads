import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AssetsPage } from './pages/AssetsPage';
import { GenerationsPage } from './pages/GenerationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './SettingsPage';
const Studio = lazy(() => import('./Studio').then((module) => ({ default: module.Studio })));
import { SessionGate } from './SessionGate';
import { Icon, cx } from './components';
import { api } from './lib/api';
import { emptyStoryboard, saveActiveProjectId, saveBoard, saveDraftMeta } from './lib/storyboard';
import { DEFAULT_PROFILE, type Generation, type WorkspaceProfile } from './lib/workspace';

type Route = 'overview' | 'create' | 'generations' | 'assets' | 'settings' | 'profile';
const routeFromHash = (): Route => {
  const segment = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (segment === 'studio') return 'create';
  return ['overview', 'create', 'generations', 'assets', 'settings', 'profile'].includes(segment) ? (segment as Route) : 'overview';
};

const links: { route: Route; label: string; icon: 'home' | 'plus' | 'film' | 'layers' | 'settings' | 'user' }[] = [
  { route: 'overview', label: 'Overview', icon: 'home' },
  { route: 'create', label: 'New creation', icon: 'plus' },
  { route: 'generations', label: 'Generations', icon: 'film' },
  { route: 'assets', label: 'Assets', icon: 'layers' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
  { route: 'profile', label: 'Profile', icon: 'user' },
];

function WorkspaceApp() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [profile, setProfile] = useState<WorkspaceProfile>(DEFAULT_PROFILE);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [search, setSearch] = useState('');
  const [newProjectToken, setNewProjectToken] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    const refresh = () => { api.generations().then((workspace) => setGenerations(workspace.generations)).catch(() => undefined); };
    window.addEventListener('workspace-updated', refresh);
    return () => window.removeEventListener('workspace-updated', refresh);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    api.generations()
      .then((workspace) => {
        setGenerations(workspace.generations);
        setProfile(workspace.profile);
      })
      .catch((error: Error) => setWorkspaceError(error.message))
      .finally(() => setWorkspaceLoaded(true));
  }, []);

  const navigate = (next: Route) => {
    if (route === next) return;
    window.location.hash = `#/${next}`;
  };

  const openGeneration = (generation: Generation) => {
    setNewProjectToken((token) => token + 1);
    saveBoard(generation.storyboard);
    saveDraftMeta(generation);
    saveActiveProjectId(generation.id);
    navigate('create');
  };

  const newCreation = () => {
    saveBoard(emptyStoryboard());
    saveActiveProjectId(null);
    setNewProjectToken((token) => token + 1);
    navigate('create');
  };

  const saveGeneration = async (generation: Generation) => {
    try {
      const response = await api.saveGeneration(generation);
      setGenerations((current) => [response.generation, ...current.filter((item) => item.id !== response.generation.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setWorkspaceError('');
      return response.generation;
    } catch (error) {
      setWorkspaceError((error as Error).message);
      throw error;
    }
  };

  const updateProfile = async (next: WorkspaceProfile) => {
    const response = await api.saveProfile(next);
    setProfile(response.profile);
    setWorkspaceError('');
  };

  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MF';

  return (
    <div className="min-h-dvh bg-ink-950 text-text">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[208px] flex-col bg-sidebar text-sidebar-text lg:flex">
        <a href="#/overview" className="flex h-[72px] items-center gap-3 border-b border-sidebar-line px-6">
          <BrandMark inverted />
          <span className="text-[17px] font-bold tracking-tight">MotionForge</span>
        </a>
        <nav aria-label="Main navigation" className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
          <NavGroup title="Workspace" links={links.slice(0, 2)} active={route} />
          <NavGroup title="Library" links={links.slice(2, 4)} active={route} />
          <NavGroup title="Manage" links={links.slice(4)} active={route} />
        </nav>
        <div className="border-t border-sidebar-line p-4">
          <button type="button" onClick={() => navigate('profile')} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-sidebar-raised">
            <Avatar initials={initials} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{profile.name}</span>
              <span className="mt-0.5 block truncate text-xs text-sidebar-dim">{profile.workspaceName}</span>
            </span>
            <Icon name="chevron" className="size-4 text-sidebar-dim" />
          </button>
        </div>
      </aside>

      <div className="min-h-dvh lg:pl-[208px]">
        <header className="sticky top-0 z-30 border-b border-line bg-ink-900/95 backdrop-blur-md">
          <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <a href="#/overview" className="flex items-center gap-2 lg:hidden"><BrandMark className="size-7" /><span className="font-bold">MotionForge</span></a>
            <label className="ml-auto flex w-full max-w-[500px] items-center gap-2 rounded-lg border border-line bg-ink-950 px-3 py-2 text-dim focus-within:border-brand-2">
              <Icon name="search" className="size-4" />
              <input
                ref={searchInput}
                value={search}
                aria-label="Search generations"
                onFocus={() => { if (route !== 'generations') navigate('generations'); }}
                onChange={(event) => { setSearch(event.target.value); if (route !== 'generations') navigate('generations'); }}
                placeholder="Search generations..."
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-dim/75"
              />
              <span className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-dim sm:inline">⌘ K</span>
            </label>
            <button type="button" onClick={() => navigate('profile')} className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-2 py-1.5 transition hover:bg-ink-800" aria-label={`Open profile for ${profile.name}`}>
              <Avatar initials={initials} small />
              <span className="hidden max-w-28 truncate text-xs font-semibold sm:inline">{profile.name}</span>
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
            {links.map((item) => <NavLink key={item.route} item={item} active={route} mobile />)}
          </nav>
        </header>

        {workspaceError ? <div role="status" className="mx-5 mt-4 rounded-lg border border-line-bright bg-ink-800 px-4 py-2 text-sm text-text lg:mx-8">Workspace save issue: {workspaceError}</div> : null}

        <main><Suspense fallback={<p className="p-8 text-sm text-dim" role="status">Opening your studio…</p>}>
          {route === 'overview' ? (
            <OverviewPage generations={generations} profile={profile} onCreate={newCreation} onViewAll={() => navigate('generations')} onOpen={openGeneration} />
          ) : null}
          {route === 'create' && workspaceLoaded ? (
            <Studio key={newProjectToken} generations={generations} onProjectSaved={saveGeneration} onNew={newCreation} />
          ) : null}
          {route === 'generations' ? (
            <GenerationsPage generations={generations} search={search} onSearchChange={setSearch} onCreate={newCreation} onOpen={openGeneration} />
          ) : null}
          {route === 'assets' ? <AssetsPage generations={generations} onOpenProject={openGeneration} /> : null}
          {route === 'settings' ? <SettingsPage /> : null}
          {route === 'profile' ? <ProfilePage profile={profile} onSave={updateProfile} /> : null}
          {!workspaceLoaded && route === 'overview' ? <p className="sr-only" role="status">Loading workspace</p> : null}
        </Suspense></main>
      </div>
    </div>
  );
}

const NavGroup: React.FC<{ title: string; links: typeof links; active: Route }> = ({ title, links: groupLinks, active }) => (
  <div>
    <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-sidebar-dim/65 uppercase">{title}</p>
    <div className="space-y-1">{groupLinks.map((item) => <NavLink key={item.route} item={item} active={active} />)}</div>
  </div>
);

const NavLink: React.FC<{ item: (typeof links)[number]; active: Route; mobile?: boolean }> = ({ item, active, mobile }) => (
  <a href={`#/${item.route}`} aria-current={active === item.route ? 'page' : undefined} className={cx(
    'flex shrink-0 items-center gap-3 rounded-lg text-sm font-medium transition',
    mobile ? 'px-3 py-2' : 'px-3 py-2.5',
    mobile
      ? active === item.route ? 'bg-ink-700 text-text shadow-[inset_3px_0_0_#3b362f]' : 'text-dim hover:bg-ink-800 hover:text-text'
      : active === item.route ? 'bg-sidebar-raised text-sidebar-text shadow-[inset_3px_0_0_#eee7db]' : 'text-sidebar-dim hover:bg-sidebar-raised hover:text-sidebar-text',
  )}>
    <Icon name={item.icon} className={cx('size-[18px]', mobile ? active === item.route ? 'text-brand-soft' : 'text-dim' : active === item.route ? 'text-sidebar-text' : 'text-sidebar-dim')} />
    {item.label}
  </a>
);

const Avatar: React.FC<{ initials: string; small?: boolean }> = ({ initials, small }) => (
  <span className={cx('flex shrink-0 items-center justify-center rounded-full font-bold', small ? 'size-7 bg-brand/15 text-[10px] text-brand-soft' : 'size-9 bg-sidebar-raised text-xs text-sidebar-text')}>
    {initials}
  </span>
);

const BrandMark: React.FC<{ className?: string; inverted?: boolean }> = ({ className, inverted = false }) => (
  <svg viewBox="0 0 32 32" className={cx('size-8 shrink-0', className)} aria-hidden>
    <defs><linearGradient id={inverted ? 'brand-cream' : 'brand-charcoal'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={inverted ? '#f3ede3' : '#3b362f'} /><stop offset="1" stopColor={inverted ? '#ddd4c5' : '#171512'} /></linearGradient></defs>
    <rect x="1" y="1" width="30" height="30" rx="10" fill={`url(#${inverted ? 'brand-cream' : 'brand-charcoal'})`} />
    <path d="M8 23 22 9M9 9h14v14" fill="none" stroke={inverted ? '#2b2823' : '#f3ede3'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function App() { return <SessionGate><WorkspaceApp /></SessionGate>; }
