import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import { SceneEditor } from './SceneList';
import { Badge, Button, Icon, Label, Notice, Select, TextArea, cx } from './components';
import { api, type ImageReference, type ModelUsage, type PublicSettings, type Voice } from './lib/api';
import {
  compositionSize,
  emptyStoryboard,
  formatBytes,
  loadActiveProjectId,
  restoreDraft,
  newScene,
  saveActiveProjectId,
  saveBoard,
  startFrameOf,
  totalFrames,
  totalSeconds,
} from './lib/storyboard';
import { DEMO_STORYBOARD } from './remotion/demo';
import { MotionGraphic } from './remotion/Video';
import { SKILLS, getSkill } from './remotion/skills';
import { ASPECTS, LAYOUT_LABELS, type Scene, type Storyboard } from './remotion/types';
import { StoryboardSchema } from './remotion/schema';
import type { Generation } from './lib/workspace';
import { useBoardHistory } from './lib/history';
import { useAutosave } from './lib/autosave';
import { readReference } from './lib/images';
import { isActiveJob, type RenderJob } from './lib/jobs';

type Props = {
  generations: Generation[];
  onProjectSaved: (generation: Generation) => Promise<Generation>;
  onNew: () => void;
};
type NoticeState = { kind: 'info' | 'ok' | 'error'; text: string };

export const Studio = ({ generations, onProjectSaved, onNew }: Props) => {
  const initial = useRef(generations.find((item) => item.id === loadActiveProjectId())).current;
  const { board, change, undo, redo, canUndo, canRedo } = useBoardHistory(() => restoreDraft(initial));
  const { status, projectId, flush, setSource } = useAutosave(board, initial, onProjectSaved);
  const [tab, setTab] = useState<'create' | 'edit'>(board.scenes.length ? 'edit' : 'create');
  const [mobilePane, setMobilePane] = useState<'director' | 'preview' | 'properties'>(
    board.scenes.length ? 'preview' : 'director',
  );
  const [brief, setBrief] = useState('');
  const [references, setReferences] = useState<ImageReference[]>([]);
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [sceneCount, setSceneCount] = useState(5);
  const [instruction, setInstruction] = useState('');
  const [scope, setScope] = useState<'scene' | 'film'>('scene');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState('');
  const [usage, setUsage] = useState<ModelUsage | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(board.scenes[0]?.id || null);
  const [frame, setFrame] = useState(0);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [jobError, setJobError] = useState('');
  const seenDone = useRef(new Set<string>());
  const player = useRef<PlayerRef>(null);
  const upload = useRef<HTMLInputElement>(null);
  const importFile = useRef<HTMLInputElement>(null);
  const selected = board.scenes.find((scene) => scene.id === selectedId) || board.scenes[0];
  const selectedIndex = selected ? board.scenes.indexOf(selected) : -1;
  const preview = board.scenes.length ? board : DEMO_STORYBOARD;
  const size = compositionSize(preview);
  const skill = getSkill(preview.skill);
  const frames = totalFrames(preview);
  const valid = StoryboardSchema.safeParse(board);
  const matchingJobs = jobs.filter((job) => job.projectId === projectId && projectId);
  const activeJob = matchingJobs.find(isActiveJob);
  const latestOutput = matchingJobs.find((job) => job.status === 'done')?.result || initial?.render;
  const activeJobs = jobs.filter(isActiveJob);

  useEffect(() => {
    api
      .settings()
      .then((next) => {
        setSettings(next);
        setVoiceId(next.elevenlabs.voiceId);
      })
      .catch((error: Error) => setNotice({ kind: 'error', text: error.message }));
  }, []);
  useEffect(() => {
    if (settings?.elevenlabs.hasKey)
      api
        .voices()
        .then((result) => setVoices(result.voices))
        .catch(() => undefined);
  }, [settings?.elevenlabs.hasKey]);
  useEffect(() => {
    let alive = true;
    let timer: number;
    const poll = async () => {
      try {
        const result = await api.jobs();
        if (alive) {
          setJobs(result.jobs);
          setJobError('');
          if (result.jobs.some((job) => job.status === 'done' && !seenDone.current.has(job.id)))
            window.dispatchEvent(new Event('workspace-updated'));
          result.jobs.filter((job) => job.status === 'done').forEach((job) => seenDone.current.add(job.id));
        }
      } catch {
        if (alive) setJobError('Export status unavailable. Your jobs continue on the server; reconnecting…');
      }
      if (alive) timer = window.setTimeout(poll, 1800);
    };
    void poll();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    const node = player.current;
    if (!node) return;
    const update = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    node.addEventListener('frameupdate', update);
    return () => node.removeEventListener('frameupdate', update);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        busy ||
        /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)
      )
        return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, undo, redo]);

  const run = async (name: string, task: () => Promise<void>) => {
    setBusy(name);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const generate = () =>
    run('plan', async () => {
      const response = await api.plan({
        brief: brief.trim(),
        references,
        targetSeconds,
        sceneCount: Math.max(sceneCount, Math.ceil(targetSeconds / 30)),
        skill: board.skill,
        aspect: board.aspect,
      });
      setSource(response.source);
      change(response.storyboard);
      setSelectedId(response.storyboard.scenes[0]!.id);
      setTab('edit');
      setMobilePane('preview');
      setUsage(response.usage);
      player.current?.seekTo(0);
      setNotice({
        kind: response.notice ? 'info' : 'ok',
        text: response.notice || 'Your storyboard is ready. Refine any scene or add your voiceover.',
      });
    });
  const edit = () =>
    run('edit', async () => {
      const response = await api.edit(
        board,
        instruction.trim(),
        scope === 'scene' ? selected?.id : undefined,
      );
      change(response.storyboard);
      setUsage(response.usage);
      setInstruction('');
      setNotice({ kind: 'ok', text: response.summary });
    });
  const voice = () =>
    run('voice', async () => {
      const clips = board.scenes
        .filter((scene) => scene.narration?.trim())
        .map((scene) => ({ id: scene.id, text: scene.narration! }));
      const result = await api.voice({ scenes: clips, voiceId });
      const measured = result.clips;
      if (measured.some((clip) => clip.seconds === 0))
        throw new Error('Could not measure a voice clip. Retry after checking the audio connection.');
      if (measured.some((clip) => clip.seconds > 29.5))
        throw new Error(
          'A narration is longer than 29.5 seconds. Shorten that scene’s narration and try again.',
        );
      const next = {
        ...board,
        scenes: board.scenes.map((scene) => {
          const clip = measured.find((item) => item.id === scene.id);
          return clip
            ? {
                ...scene,
                audio: clip.audio,
                seconds: Math.max(scene.seconds, Math.ceil((clip.seconds + 0.5) * 2) / 2),
              }
            : scene;
        }),
      };
      change(StoryboardSchema.parse(next));
      setNotice({
        kind: 'ok',
        text: `Voiceover ready for ${result.clips.length} scenes. Timing now fits the speech.`,
      });
    });
  const exportVideo = () =>
    run('export', async () => {
      const saved = await flush();
      const result = await api.export(StoryboardSchema.parse(board), saved?.id);
      setJobs((current) => [result.job, ...current.filter((item) => item.id !== result.job.id)]);
      setNotice({
        kind: 'info',
        text: 'Export queued. You can keep editing or return later; the export uses this version of your video.',
      });
    });
  const select = (scene: Scene, index: number) => {
    setSelectedId(scene.id);
    player.current?.seekTo(
      startFrameOf(board, index) +
        Math.min(Math.round(board.fps * 0.8), Math.round(scene.seconds * board.fps) - 1),
    );
  };
  const patch = (patch: Partial<Scene>) =>
    change({
      ...board,
      scenes: board.scenes.map((scene) =>
        scene.id === selected?.id
          ? {
              ...scene,
              ...patch,
              ...(patch.seconds !== undefined && patch.seconds < scene.seconds ? { audio: undefined } : {}),
            }
          : scene,
      ),
    });
  const move = (direction: -1 | 1) => {
    const next = [...board.scenes];
    const target = selectedIndex + direction;
    if (target < 0 || target >= next.length) return;
    [next[selectedIndex], next[target]] = [next[target]!, next[selectedIndex]!];
    change({ ...board, scenes: next });
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motionforge-project.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="editor-shell">
      <header className="editor-toolbar">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            Motion studio <span className="mx-2 text-line">/</span>{' '}
            {board.scenes.length ? 'Editor' : 'New project'}
          </p>
          <input
            aria-label="Project title"
            className="project-title"
            maxLength={120}
            value={board.title}
            disabled={!!busy}
            onChange={(event) => change({ ...board, title: event.target.value })}
          />
          <span
            className={cx('save-state', status.startsWith('Save failed') && 'text-red-700')}
            role="status"
          >
            {status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo || !!busy} aria-label="Undo">
            ↶ Undo
          </Button>
          <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo || !!busy} aria-label="Redo">
            ↷
          </Button>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant="ghost" onClick={() => importFile.current?.click()} disabled={!!busy}>
            Import
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadJson} disabled={!valid.success}>
            Save JSON
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void run('new', async () => {
                await flush();
                onNew();
              })
            }
            disabled={!!busy}
            icon={<Icon name="plus" />}
          >
            New
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={exportVideo}
            disabled={!valid.success || !!busy || !!activeJob}
            icon={<Icon name="download" />}
          >
            {busy === 'export' ? 'Queuing…' : activeJob ? 'Exporting…' : 'Export MP4'}
          </Button>
        </div>
        <input
          ref={importFile}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import project"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void run('import', async () => {
              if (file.size > 1_000_000) throw new Error('Project JSON must be under 1 MB.');
              const next = StoryboardSchema.parse(JSON.parse(await file.text()));
              await flush();
              saveActiveProjectId(null);
              saveBoard(next);
              window.location.reload();
            });
          }}
        />
      </header>
      <div className="px-4 pt-3 lg:px-6">
        {notice && (
          <Notice kind={notice.kind} onClose={() => setNotice(null)}>
            {notice.text}
          </Notice>
        )}
      </div>
      <div className="editor-mobile-tabs" role="tablist" aria-label="Editor panels">
        {(['director', 'preview', 'properties'] as const).map((pane) => (
          <button
            key={pane}
            role="tab"
            aria-selected={mobilePane === pane}
            onClick={() => setMobilePane(pane)}
          >
            {pane === 'director' ? 'Director' : pane === 'preview' ? 'Preview & timeline' : 'Properties'}
          </button>
        ))}
      </div>
      <div className="editor-grid" data-mobile-pane={mobilePane}>
        <aside className="director-panel">
          <div className="panel-tabs" role="tablist" aria-label="Director tools">
            {(['create', 'edit'] as const).map((value) => (
              <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
                {value === 'create' ? '01 / Create' : '02 / AI editor'}
              </button>
            ))}
          </div>
          <fieldset disabled={!!busy} className="min-w-0 space-y-5 p-4">
            {tab === 'create' ? (
              <>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">What’s the story?</h2>
                  <p className="mt-1 text-xs leading-relaxed text-dim">
                    A brief, an image, or a little of both. We’ll give your idea a rhythm.
                  </p>
                </div>
                <div>
                  <Label htmlFor="creative-brief">Your brief</Label>
                  <TextArea
                    id="creative-brief"
                    aria-label="Creative brief"
                    rows={5}
                    maxLength={4000}
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    placeholder="A punchy launch film for my app. Open with the problem, show three benefits, end with ‘Try it today’."
                  />
                </div>
                <div>
                  <Label>
                    Visual references <span className="font-normal">{references.length}/3</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {references.map((ref, index) => (
                      <div key={ref.name + index} className="reference-thumb">
                        <img src={ref.dataUrl} alt={ref.name} />
                        <button
                          aria-label={`Remove ${ref.name}`}
                          onClick={() => setReferences(references.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="reference-upload"
                    onClick={() => upload.current?.click()}
                    disabled={references.length >= 3}
                  >
                    <Icon name="plus" /> Add reference image
                  </button>
                  <input
                    ref={upload}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    aria-label="Reference images"
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      event.target.value = '';
                      void run('upload', async () => {
                        if (files.length + references.length > 3)
                          throw new Error('Use up to three references.');
                        const next = await Promise.all(files.map(readReference));
                        setReferences([...references, ...next]);
                      });
                    }}
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-dim">
                    References guide the text model’s colors and vector art. Requires vision support. PNG,
                    JPEG, WebP.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="length">Duration</Label>
                    <Select
                      id="length"
                      value={targetSeconds}
                      onChange={(e) => setTargetSeconds(Number(e.target.value))}
                    >
                      {[15, 20, 30, 45, 60, 90, 120, 180].map((value) => (
                        <option key={value} value={value}>
                          {value}s
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="scenes">Scenes</Label>
                    <Select
                      id="scenes"
                      value={sceneCount}
                      onChange={(e) => setSceneCount(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6, 8, 10, 12].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={generate}
                  disabled={brief.trim().length < 3 && !references.length}
                  loading={busy === 'plan'}
                  icon={<Icon name="sparkles" />}
                >
                  {settings?.ai.hasKey ? 'Create motion storyboard' : 'Create sample outline'}
                </Button>
                {!!board.scenes.length && (
                  <p className="text-[11px] text-dim">
                    Creates a new storyboard in this project. Undo restores your previous edit.
                  </p>
                )}
                {!settings?.ai.hasKey && (
                  <a href="#/settings" className="block text-xs font-medium underline">
                    Connect a text model for AI creation →
                  </a>
                )}
              </>
            ) : (
              <>
                <div>
                  <Badge tone="accent">Your creative copilot</Badge>
                  <h2 className="mt-3 text-lg font-bold tracking-tight">Direct the next edit.</h2>
                  <p className="mt-1 text-xs leading-relaxed text-dim">
                    Change the words, timing, vector art, or art direction. Every change is editable and
                    undoable.
                  </p>
                </div>
                <div>
                  <Label htmlFor="scope">Apply to</Label>
                  <Select
                    id="scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'scene' | 'film')}
                  >
                    <option value="scene">
                      Selected scene {selectedIndex >= 0 ? `· ${selectedIndex + 1}` : ''}
                    </option>
                    <option value="film">Entire video</option>
                  </Select>
                </div>
                <TextArea
                  aria-label="AI edit instruction"
                  rows={6}
                  maxLength={2000}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Make this headline punchier. Add a minimal vector illustration of a rocket, with a gentle float."
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Make the copy punchier',
                    'Use a split layout with a custom vector illustration',
                    'Make the pacing faster',
                  ].map((text) => (
                    <button key={text} className="prompt-chip" onClick={() => setInstruction(text)}>
                      {text}
                    </button>
                  ))}
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={edit}
                  disabled={!valid.success || instruction.trim().length < 3 || !settings?.ai.hasKey}
                  loading={busy === 'edit'}
                  icon={<Icon name="sparkles" />}
                >
                  Apply AI edit
                </Button>
                {!settings?.ai.hasKey && (
                  <a href="#/settings" className="block text-xs font-medium underline">
                    Connect your text model to edit with AI →
                  </a>
                )}
                <p className="text-[11px] leading-relaxed text-dim">
                  One text-model request per edit. Selected-scene edits send only that scene’s context.
                </p>
              </>
            )}
            {usage && (
              <div className="usage-card">
                <p className="eyebrow">Last model request</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt>Input</dt>
                    <dd>{usage.inputTokens.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Output</dt>
                    <dd>{usage.outputTokens.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{usage.totalTokens.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            )}
          </fieldset>
          <div className="director-footer">
            <Icon name="bolt" />
            <span>
              Text models. Real motion.
              <br />
              <span className="text-dim">No image or video generation.</span>
            </span>
          </div>
        </aside>

        <section className="preview-column" aria-label="Video preview and timeline">
          <div className="preview-header">
            <Badge tone={board.scenes.length ? 'ok' : 'neutral'}>
              {board.scenes.length ? 'Live preview' : 'Example film'}
            </Badge>
            <span>
              {size.width} × {size.height} · {preview.fps} fps
            </span>
          </div>
          <div className="preview-stage">
            <div
              className="preview-player"
              style={{ maxWidth: preview.aspect === '9:16' ? 260 : preview.aspect === '1:1' ? 420 : 920 }}
            >
              <Player
                ref={player}
                component={MotionGraphic}
                inputProps={{ storyboard: preview }}
                initialFrame={Math.min(20, Math.max(0, frames - 1))}
                durationInFrames={Math.max(1, frames)}
                compositionWidth={size.width}
                compositionHeight={size.height}
                fps={preview.fps}
                controls
                loop
                acknowledgeRemotionLicense
                style={{ width: '100%' }}
              />
            </div>
            {!board.scenes.length && (
              <div className="mt-4 flex justify-center">
                <Button
                  size="sm"
                  onClick={() => {
                    change(DEMO_STORYBOARD);
                    setSource('manual');
                    setSelectedId(DEMO_STORYBOARD.scenes[0]!.id);
                    setTab('edit');
                    setMobilePane('preview');
                  }}
                  icon={<Icon name="play" />}
                >
                  Edit this example
                </Button>
              </div>
            )}
          </div>
          <div className="transport-bar">
            <span className="font-mono">
              {(frame / preview.fps).toFixed(1)}s{' '}
              <span className="text-dim">/ {totalSeconds(preview).toFixed(1)}s</span>
            </span>
            <span>{skill.name}</span>
            <span>{preview.aspect}</span>
          </div>
          <div className="timeline-section">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="eyebrow">Scene timeline</h2>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy || board.scenes.length >= 24}
                onClick={() => {
                  const scene = newScene();
                  change({ ...board, scenes: [...board.scenes, scene] });
                  setSelectedId(scene.id);
                }}
                icon={<Icon name="plus" />}
              >
                Add scene
              </Button>
            </div>
            <input
              className="mb-4 w-full"
              aria-label="Scrub video"
              type="range"
              min={0}
              max={Math.max(0, frames - 1)}
              value={Math.min(frame, frames - 1)}
              onChange={(e) => {
                player.current?.pause();
                player.current?.seekTo(Number(e.target.value));
              }}
            />
            <div className="scene-timeline">
              {board.scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  className={cx('timeline-clip', selected?.id === scene.id && 'selected')}
                  style={{
                    flexGrow: scene.seconds,
                    borderTopColor: scene.accent || getSkill(board.skill).palette.accent,
                  }}
                  onClick={() => select(scene, index)}
                  aria-pressed={selected?.id === scene.id}
                  aria-label={`Select scene ${index + 1}: ${scene.headline}`}
                >
                  <span className="flex justify-between text-[10px] opacity-65">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{scene.seconds}s</span>
                  </span>
                  <strong>{scene.headline}</strong>
                  <span className="mt-auto flex items-center gap-1 text-[9px] opacity-65">
                    {scene.audio && <Icon name="mic" className="size-2.5" />}
                    {LAYOUT_LABELS[scene.layout]}
                  </span>
                </button>
              ))}
            </div>
            {!board.scenes.length && (
              <p className="py-4 text-center text-xs text-dim">
                Create a storyboard or load the example to start editing.
              </p>
            )}
          </div>
          <div className="export-panel">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow">Exports</h2>
              <span className="text-[11px] text-dim">MP4 · H.264 / AAC</span>
            </div>
            {jobError && (
              <p role="status" className="mt-2 text-xs text-red-700">
                {jobError}
              </p>
            )}
            {matchingJobs.slice(0, 3).map((job) => (
              <div key={job.id} className="export-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {job.title}{' '}
                    <span className="ml-2 font-normal text-dim">
                      {job.status}
                      {isActiveJob(job) ? ` · ${Math.round(job.progress * 100)}%` : ''}
                    </span>
                  </p>
                  {job.error && (
                    <p role="alert" className="mt-1 text-xs text-red-700">
                      {job.error}
                    </p>
                  )}
                  {isActiveJob(job) && (
                    <progress
                      className="mt-2 h-1 w-full accent-brand"
                      max={1}
                      value={job.progress}
                      aria-label="Export progress"
                    />
                  )}
                </div>
                {job.result && (
                  <a href={job.result.url} download={job.result.fileName} className="download-link">
                    Download <Icon name="download" />
                  </a>
                )}
                {isActiveJob(job) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void run('cancel', async () => {
                        await api.cancelExport(job.id);
                        setJobs((all) =>
                          all.map((item) => (item.id === job.id ? { ...item, status: 'cancelled' } : item)),
                        );
                      })
                    }
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
            {!matchingJobs.length && (
              <p className="mt-3 text-xs leading-relaxed text-dim">
                {activeJobs.length ? `${activeJobs.length} export(s) running in this workspace. ` : ''}Export
                a snapshot of your current edit. Downloads stay available after you close the browser.
              </p>
            )}
            {latestOutput && !matchingJobs.length && (
              <a className="download-link mt-3" href={latestOutput.url} download={latestOutput.fileName}>
                Download previous export · {formatBytes(latestOutput.bytes)} <Icon name="download" />
              </a>
            )}
          </div>
        </section>

        <aside className="inspector-panel">
          <div className="inspector-heading">
            <Icon name="layers" />
            <h2>Properties</h2>
            <span className="ml-auto text-xs text-dim">
              {selected ? `${selectedIndex + 1} / ${board.scenes.length}` : 'Project'}
            </span>
          </div>
          <fieldset disabled={!!busy} className="min-w-0">
            <div className="space-y-4 border-b border-line p-4">
              <div>
                <Label htmlFor="art-direction">Art direction</Label>
                <Select
                  id="art-direction"
                  value={board.skill}
                  onChange={(e) => change({ ...board, skill: e.target.value as Storyboard['skill'] })}
                >
                  {SKILLS.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </Select>
                <div className="mt-2 flex gap-1.5">
                  {Object.values(getSkill(board.skill).palette)
                    .slice(0, 7)
                    .map((color, i) => (
                      <span
                        key={i}
                        className="size-5 rounded-full border border-black/10"
                        style={{ background: color }}
                      />
                    ))}
                </div>
              </div>
              <div>
                <Label htmlFor="aspect-ratio">Canvas</Label>
                <Select
                  id="aspect-ratio"
                  value={board.aspect}
                  onChange={(e) => change({ ...board, aspect: e.target.value as Storyboard['aspect'] })}
                >
                  {ASPECTS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </div>
            </div>
            {selected ? (
              <>
                <div className="flex flex-wrap justify-between gap-1 px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Move scene earlier"
                    disabled={selectedIndex <= 0}
                    onClick={() => move(-1)}
                    icon={<Icon name="up" />}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Move scene later"
                    disabled={selectedIndex >= board.scenes.length - 1}
                    onClick={() => move(1)}
                    icon={<Icon name="down" />}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Duplicate scene"
                    disabled={board.scenes.length >= 24}
                    icon={<Icon name="copy" />}
                    onClick={() => {
                      const next = { ...selected, id: crypto.randomUUID(), audio: undefined };
                      const scenes = [...board.scenes];
                      scenes.splice(selectedIndex + 1, 0, next);
                      change({ ...board, scenes });
                      setSelectedId(next.id);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete scene"
                    disabled={board.scenes.length <= 1}
                    icon={<Icon name="trash" />}
                    onClick={() => {
                      change({ ...board, scenes: board.scenes.filter((scene) => scene.id !== selected.id) });
                      setSelectedId(null);
                    }}
                  />
                </div>
                <SceneEditor key={selected.id} scene={selected} patch={patch} />
              </>
            ) : (
              <p className="p-4 text-xs leading-relaxed text-dim">
                Choose an art direction, then create your first storyboard.
              </p>
            )}
            <div className="space-y-3 border-t border-line p-4">
              <h2 className="eyebrow">Voiceover</h2>
              {settings?.elevenlabs.hasKey ? (
                <>
                  <Select
                    aria-label="Narrator voice"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                  >
                    {voices.length ? (
                      voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))
                    ) : (
                      <option value={voiceId}>Saved voice</option>
                    )}
                  </Select>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={voice}
                    loading={busy === 'voice'}
                    disabled={!board.scenes.some((scene) => scene.narration?.trim())}
                    icon={<Icon name="mic" />}
                  >
                    Generate voiceover
                  </Button>
                  <p className="text-[11px] leading-relaxed text-dim">
                    Uses ElevenLabs credits. Unchanged lines are cached. Scene timing adjusts to fit.
                  </p>
                </>
              ) : (
                <a href="#/settings" className="text-xs leading-relaxed text-dim underline">
                  Connect ElevenLabs to add narration →
                </a>
              )}
            </div>
          </fieldset>
          {board.scenes.length > 0 && !valid.success && (
            <p role="alert" className="p-4 text-xs text-red-700">
              {valid.error.issues[0]?.message} Finish this edit before saving or exporting.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export const clearCurrentProject = () => {
  saveActiveProjectId(null);
  saveBoard(emptyStoryboard());
};
