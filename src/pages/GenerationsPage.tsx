import React, { useMemo, useState } from 'react';
import { Button, Icon } from '../components';
import type { Generation } from '../lib/workspace';

type Filter = 'all' | 'draft' | 'rendered';

type Props = {
  generations: Generation[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onOpen: (generation: Generation) => void;
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export const GenerationsPage: React.FC<Props> = ({ generations, search, onSearchChange, onCreate, onOpen }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(() => generations.filter((generation) => {
    const matchesFilter = filter === 'all' || (filter === 'rendered' ? Boolean(generation.render) : !generation.render);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${generation.title} ${generation.storyboard.skill} ${generation.source}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [filter, generations, search]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 lg:px-8 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-dim uppercase">Library</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Generations</h1>
          <p className="mt-2 text-base text-dim">Every storyboard you create, with its render when one is ready.</p>
        </div>
        <Button variant="primary" onClick={onCreate} icon={<Icon name="plus" />}>New creation</Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-900 p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter generations">
          {(['all', 'draft', 'rendered'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${filter === value ? 'bg-brand/25 text-brand-soft' : 'text-dim hover:bg-ink-800 hover:text-text'}`}>
              {value === 'all' ? `All ${generations.length}` : value === 'draft' ? `Drafts ${generations.filter((item) => !item.render).length}` : `Rendered ${generations.filter((item) => item.render).length}`}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] items-center gap-2 rounded-lg border border-line bg-ink-950 px-3 py-2 text-dim focus-within:border-brand-2">
          <Icon name="search" className="size-4" />
          <input aria-label="Search generations" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search generations" className="w-full bg-transparent text-sm text-text outline-none placeholder:text-dim/70" />
        </label>
      </div>

      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((generation) => <GenerationCard key={generation.id} generation={generation} onOpen={() => onOpen(generation)} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-ink-900 px-5 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink-800 text-dim"><Icon name="film" className="size-5" /></span>
          <h2 className="mt-3 text-lg font-semibold">{search ? 'No matching generations' : 'No generations yet'}</h2>
          <p className="mt-1 text-sm text-dim">{search ? 'Try a different search.' : 'Create a storyboard and it will be saved here automatically.'}</p>
          {!search ? <Button variant="primary" size="sm" className="mt-4" onClick={onCreate} icon={<Icon name="plus" />}>Create your first</Button> : null}
        </div>
      )}
    </div>
  );
};

const GenerationCard: React.FC<{ generation: Generation; onOpen: () => void }> = ({ generation, onOpen }) => {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-ink-900 shadow-panel">
      <div className="relative flex h-36 items-end overflow-hidden bg-ink-950 p-4 text-text">
        <span className="absolute -right-5 -top-12 size-40 rounded-full bg-brand/35" />
        <span className="absolute right-12 top-9 size-20 rotate-12 rounded-xl bg-ink-700" />
        <span className="relative inline-flex items-center gap-2 rounded-md bg-ink-800 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
          <span className="size-1.5 rounded-full bg-brand-2" />{generation.storyboard.skill.replaceAll('-', ' ')}
        </span>
        {generation.render ? <span className="absolute right-3 top-3 rounded-full bg-ink-800 px-2.5 py-1 text-[10px] font-semibold text-text">Rendered</span> : null}
      </div>
      <div className="p-4">
        <h2 className="truncate text-base font-bold">{generation.title}</h2>
        <p className="mt-1 text-xs text-dim">{generation.storyboard.scenes.length} scenes · {generation.storyboard.aspect} · {dateLabel(generation.updatedAt)}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-dim">{generation.render ? 'Video ready' : 'Storyboard draft'}</span>
          <div className="flex items-center gap-2">
            {generation.render ? <a href={generation.render.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:bg-ink-800">Open MP4</a> : null}
            <button type="button" onClick={onOpen} className="rounded-lg bg-ink-800 px-3 py-2 text-xs font-semibold text-text hover:bg-ink-700">Open project</button>
          </div>
        </div>
      </div>
    </article>
  );
};
