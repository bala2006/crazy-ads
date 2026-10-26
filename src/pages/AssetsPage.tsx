import React, { useEffect, useState } from 'react';
import { Button, Icon, Select } from '../components';
import type { Generation } from '../lib/workspace';
import { responsiveSvg, sanitizeInlineSvg } from '../lib/svg';

type Props = { generations: Generation[]; onOpenProject: (generation: Generation) => void };

export const AssetsPage: React.FC<Props> = ({ generations, onOpenProject }) => {
  const [selectedId, setSelectedId] = useState(generations[0]?.id ?? '');
  useEffect(() => {
    if (!generations.some((item) => item.id === selectedId)) setSelectedId(generations[0]?.id ?? '');
  }, [generations, selectedId]);

  const project = generations.find((item) => item.id === selectedId);
  const vectors = project?.storyboard.scenes.flatMap((scene, index) => {
    const svg = sanitizeInlineSvg(scene.visualSvg);
    return svg ? [{ sceneId: scene.id, title: scene.headline.replace(/\n/g, ' '), number: index + 1, svg }] : [];
  }) ?? [];
  const audio = project?.storyboard.scenes.flatMap((scene, index) => scene.audio ? [{
    sceneId: scene.id,
    title: scene.headline.replace(/\n/g, ' '),
    number: index + 1,
    src: /^https?:\/\//.test(scene.audio) || scene.audio.startsWith('/') ? scene.audio : `/${scene.audio}`,
  }] : []) ?? [];
  const rendered = project?.render;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 lg:px-8 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-dim uppercase">Library</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Video assets</h1>
          <p className="mt-2 text-base text-dim">Vectors, voice clips, and exports used by each video.</p>
        </div>
        {project ? <Button variant="secondary" onClick={() => onOpenProject(project)}>Open in editor <Icon name="arrow" /></Button> : null}
      </header>

      {generations.length ? (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <section className="h-fit rounded-xl border border-line bg-ink-900 p-4">
            <label className="block text-xs font-semibold text-dim">Video
              <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2">
                {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.title}</option>)}
              </Select>
            </label>
            {project ? (
              <div className="mt-4 rounded-lg bg-ink-800 p-3">
                <p className="truncate text-sm font-semibold">{project.title}</p>
                <p className="mt-1 text-xs text-dim">{project.storyboard.scenes.length} scenes · {project.storyboard.aspect}</p>
                <div className="mt-3 flex gap-2 text-[11px] text-dim">
                  <span>{vectors.length} vector</span><span>·</span><span>{audio.length} voice clips</span><span>·</span><span>{rendered ? '1 MP4' : 'No MP4'}</span>
                </div>
              </div>
            ) : null}
          </section>

          <div className="space-y-6">
            <AssetSection title="SVG & vector art" count={vectors.length} empty="No vector illustrations were generated for this video. You can add safe inline SVG to a scene in the editor.">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {vectors.map((asset) => {
                  const svg = responsiveSvg(asset.svg);
                  return (
                    <article key={asset.sceneId} className="overflow-hidden rounded-lg border border-line bg-ink-900">
                      <div className="flex h-40 items-center justify-center bg-ink-800 p-5">
                        {svg ? <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold tracking-wide text-brand-soft uppercase">Scene {asset.number} · SVG</p>
                          <p className="mt-1 truncate text-sm font-semibold">{asset.title}</p>
                        </div>
                        <a className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-ink-800" download={`scene-${asset.number}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`}>Download</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </AssetSection>

            <AssetSection title="Voice clips" count={audio.length} empty="Voice clips generated with ElevenLabs will appear here by scene.">
              <div className="grid gap-3 lg:grid-cols-2">
                {audio.map((asset) => (
                  <div key={asset.sceneId} className="rounded-lg border border-line bg-ink-900 p-4">
                    <p className="text-[10px] font-semibold tracking-wide text-brand-soft uppercase">Scene {asset.number} · ElevenLabs</p>
                    <p className="mt-1 truncate text-sm font-semibold">{asset.title}</p>
                    <audio className="mt-3 w-full" controls preload="none" src={asset.src}>Audio playback is not supported by this browser.</audio>
                  </div>
                ))}
              </div>
            </AssetSection>

            <AssetSection title="Video export" count={rendered ? 1 : 0} empty="Render the project in the editor to add an MP4 export here.">
              {rendered ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-ink-900 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-ink-800 text-text"><Icon name="play" /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{rendered.fileName}</p><p className="mt-1 text-xs text-dim">MP4 · {(rendered.bytes / (1024 * 1024)).toFixed(1)} MB · {(rendered.ms / 1000).toFixed(1)} sec render</p></div>
                  </div>
                  <div className="flex gap-2">
                    <a href={rendered.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:bg-ink-800">Preview</a>
                    <a href={rendered.url} download={rendered.fileName} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-ink-800">Export MP4</a>
                  </div>
                </div>
              ) : null}
            </AssetSection>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-ink-900 px-5 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/20 text-brand-soft"><Icon name="layers" className="size-5" /></span>
          <h2 className="mt-3 text-lg font-semibold">Assets follow the video</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-dim">Generate a storyboard, add vector artwork or voiceover, and the assets for each video will be collected here.</p>
        </div>
      )}
    </div>
  );
};

const AssetSection: React.FC<{ title: string; count: number; empty: string; children: React.ReactNode }> = ({ title, count, empty, children }) => (
  <section>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <span className="rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-dim">{count}</span>
    </div>
    {count ? children : <p className="rounded-lg border border-dashed border-line bg-ink-900 px-4 py-5 text-sm text-dim">{empty}</p>}
  </section>
);
