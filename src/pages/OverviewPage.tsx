import React from 'react';
import { Button, Icon, Panel } from '../components';
import type { Generation, WorkspaceProfile } from '../lib/workspace';
import { getSkill } from '../remotion/skills';

type Props = {
  generations: Generation[];
  profile: WorkspaceProfile;
  onCreate: () => void;
  onViewAll: () => void;
  onOpen: (generation: Generation) => void;
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export const OverviewPage: React.FC<Props> = ({ generations, profile, onCreate, onViewAll, onOpen }) => {
  const rendered = generations.filter((item) => item.render).length;
  const draftCount = generations.length - rendered;
  const sceneCount = generations.reduce((sum, item) => sum + item.storyboard.scenes.length, 0);
  const recent = generations.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-5 py-7 lg:px-8 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-dim uppercase">Your workspace</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {profile.name}</h1>
          <p className="mt-2 text-base text-dim">Your motion projects, all in one place.</p>
        </div>
        <Button variant="primary" onClick={onCreate} icon={<Icon name="plus" />}>New creation</Button>
      </header>

      <section aria-label="Workspace overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="film" label="Generations" value={generations.length} tone="forest" />
        <StatCard icon="clock" label="Drafts" value={draftCount} tone="neutral" />
        <StatCard icon="play" label="Rendered videos" value={rendered} tone="red" />
        <StatCard icon="layers" label="Scenes created" value={sceneCount} tone="forest" />
      </section>

      <Panel
        title="Recent generations"
        hint="Your latest storyboards and rendered videos"
        action={<button onClick={onViewAll} className="text-sm font-semibold text-brand-soft hover:underline">View all</button>}
      >
        {recent.length ? (
          <div className="divide-y divide-line">
            {recent.map((generation) => {
              const skill = getSkill(generation.storyboard.skill);
              return (
                <button
                  type="button"
                  key={generation.id}
                  onClick={() => onOpen(generation)}
                  className="flex w-full items-center gap-4 py-3 text-left first:pt-0 last:pb-0 hover:bg-ink-800/60"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand-soft">
                    <Icon name="film" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{generation.title}</span>
                    <span className="mt-1 block text-xs text-dim">{generation.storyboard.scenes.length} scenes · {skill.name} · {dateLabel(generation.updatedAt)}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${generation.render ? 'bg-ink-800 text-text' : 'bg-ink-800 text-dim'}`}>
                    {generation.render ? 'Rendered' : 'Draft'}
                  </span>
                  <Icon name="chevron" className="size-4 text-dim" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-ink-800/40 px-5 py-8 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/20 text-brand-soft"><Icon name="sparkles" className="size-5" /></span>
            <h3 className="mt-3 text-sm font-semibold">Your first generation starts here</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-dim">Create a storyboard from a short brief, shape the scenes, and render a video when it is ready.</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={onCreate} icon={<Icon name="plus" />}>Start creating</Button>
          </div>
        )}
      </Panel>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-brand/45 bg-brand/15 p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-soft uppercase">Create something new</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">From a one-line idea to a finished film.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-dim">Pick an art direction, generate a storyboard, then edit each scene in the studio.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={onCreate} icon={<Icon name="arrow" />}>Open the studio</Button>
        </div>
        <div className="rounded-xl border border-line bg-ink-900 p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-dim uppercase">Workspace</p>
          <h2 className="mt-2 text-lg font-bold">{profile.workspaceName}</h2>
          <p className="mt-1 text-sm text-dim">Saved locally on this MotionForge server.</p>
          <p className="mt-4 text-xs text-dim">{generations.length} {generations.length === 1 ? 'generation' : 'generations'} · {rendered} {rendered === 1 ? 'video' : 'videos'} · {sceneCount} scenes</p>
        </div>
      </section>
    </div>
  );
};

const StatCard: React.FC<{ icon: 'film' | 'clock' | 'play' | 'layers'; label: string; value: number; tone: 'forest' | 'neutral' | 'red' }> = ({ icon, label, value, tone }) => {
  const toneClass = {
    forest: 'bg-brand/20 text-brand-soft',
    neutral: 'bg-ink-800 text-dim',
    red: 'bg-ink-800 text-text',
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-ink-900 p-4 shadow-panel sm:p-5">
      <span className={`mb-4 flex size-10 items-center justify-center rounded-lg ${toneClass}`}><Icon name={icon} className="size-5" /></span>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-dim uppercase">{label}</p>
    </div>
  );
};
