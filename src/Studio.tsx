import { Player, type PlayerRef } from '@remotion/player';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SceneList } from './SceneList';
import { Badge, Button, Icon, Label, Notice, Panel, Select, TextArea, TextInput, cx } from './components';
import { api, audioDuration, renderVideo, type PublicSettings, type RenderResult, type Voice } from './lib/api';
import {
  compositionSize,
  emptyStoryboard,
  formatBytes,
  formatSeconds,
  loadBoard,
  loadActiveProjectId,
  newScene,
  saveBoard,
  saveActiveProjectId,
  startFrameOf,
  totalFrames,
  totalSeconds,
} from './lib/storyboard';
import { DEMO_STORYBOARD } from './remotion/demo';
import { MotionGraphic } from './remotion/Video';
import { SKILLS, getSkill } from './remotion/skills';
import { ASPECTS, type AspectId, type Storyboard } from './remotion/types';
import type { Generation } from './lib/workspace';
import { sanitizeInlineSvg } from './lib/svg';

type Notice_ = { kind: 'info' | 'ok' | 'error'; text: string };
type Busy = 'plan' | 'voice' | 'render' | null;

const DURATIONS = [15, 20, 30, 45, 60, 90];
const SCENE_COUNTS = [3, 4, 5, 6, 7, 8];

type Props = {
  generations: Generation[];
  onProjectSaved: (generation: Generation) => Promise<void>;
  newProjectToken: number;
  workspaceLoaded: boolean;
};

export const Studio: React.FC<Props> = ({ generations, onProjectSaved, newProjectToken, workspaceLoaded }) => {
  const [board, setBoard] = useState<Storyboard>(() => loadBoard());
  const activeProjectRef = useRef<string | null>(loadActiveProjectId());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => activeProjectRef.current);
  const lastPersistedBoard = useRef(JSON.stringify(board));
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState('');

  const [brief, setBrief] = useState('');
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [sceneCount, setSceneCount] = useState(5);
  const [withNarration, setWithNarration] = useState(true);

  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<RenderResult | null>(() => generations.find((item) => item.id === activeProjectRef.current)?.render ?? null);
  const [notice, setNotice] = useState<Notice_ | null>(null);
  const [openScene, setOpenScene] = useState<string | null>(null);

  const playerRef = useRef<PlayerRef>(null);

  const selectProject = (id: string | null) => {
    activeProjectRef.current = id;
    saveActiveProjectId(id);
    setActiveProjectId(id);
  };

  const persistProject = (storyboard: Storyboard, source: Generation['source'], render?: Generation['render']) => {
    const existingId = activeProjectRef.current;
    const existing = generations.find((item) => item.id === existingId);
    const now = new Date().toISOString();
    const generation: Generation = {
      id: existingId ?? crypto.randomUUID(),
      title: storyboard.title,
      source: existing?.source ?? source,
      storyboard,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(render ?? existing?.render ? { render: render ?? existing?.render } : {}),
    };
    if (!existingId) selectProject(generation.id);
    void onProjectSaved(generation).catch((error: Error) => setNotice({ kind: 'error', text: `Could not save this project: ${error.message}` }));
    return generation;
  };

  useEffect(() => {
    if (!newProjectToken) return;
    setBoard(emptyStoryboard());
    selectProject(null);
    setResult(null);
    setNotice(null);
  }, [newProjectToken]);

  useEffect(() => {
    saveBoard(board);
    if (!workspaceLoaded) return;
    if (!board.scenes.length) return;
    if (board.scenes.some((scene) => scene.visualSvg && !sanitizeInlineSvg(scene.visualSvg))) return;
    const serializedBoard = JSON.stringify(board);
    if (serializedBoard === lastPersistedBoard.current && activeProjectId) return;
    lastPersistedBoard.current = serializedBoard;
    const timeout = window.setTimeout(() => persistProject(board, 'manual'), 450);
    return () => window.clearTimeout(timeout);
  }, [board, activeProjectId, workspaceLoaded]);

  useEffect(() => {
    setResult(generations.find((item) => item.id === activeProjectId)?.render ?? null);
  }, [activeProjectId, generations]);

  useEffect(() => {
    api
      .settings()
      .then((next) => {
        setSettings(next);
        setVoiceId((current) => current || next.elevenlabs.voiceId);
      })
      .catch((error: Error) => setNotice({ kind: 'error', text: error.message }));
  }, []);

  const hasElevenLabs = Boolean(settings?.elevenlabs.hasKey);

  useEffect(() => {
    if (!hasElevenLabs) return;
    api
      .voices()
      .then((response) => setVoices(response.voices))
      .catch(() => undefined);
  }, [hasElevenLabs]);

  const isDemo = board.scenes.length === 0;
  const previewBoard = isDemo ? DEMO_STORYBOARD : board;
  const previewSize = useMemo(() => compositionSize(previewBoard), [previewBoard]);
  const skill = getSkill(board.skill);
  const frames = Math.max(1, totalFrames(previewBoard));
  const narrationCount = board.scenes.filter((scene) => scene.narration?.trim()).length;
  const previewMaxWidth = previewBoard.aspect === '9:16' ? 300 : previewBoard.aspect === '1:1' ? 460 : 880;

  const generate = async () => {
    if (brief.trim().length < 3) {
      setNotice({ kind: 'error', text: 'Describe the video you want first.' });
      return;
    }
    setBusy('plan');
    setNotice(null);
    setResult(null);
    try {
      const response = await api.plan({
        brief: brief.trim(),
        skill: board.skill,
        aspect: board.aspect,
        targetSeconds,
        sceneCount,
      });
      const scenes = response.storyboard.scenes.map((scene) =>
        withNarration ? scene : { ...scene, narration: undefined, audio: undefined },
      );
      const next: Storyboard = { ...response.storyboard, scenes };
      selectProject(null);
      persistProject(next, response.source);
      setBoard(next);
      setOpenScene(null);
      playerRef.current?.seekTo(0);
      setNotice(
        response.notice
          ? { kind: 'info', text: response.notice }
          : { kind: 'ok', text: `Storyboard ready — ${scenes.length} scenes, ${formatSeconds(totalSeconds(next))}.` },
      );
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const generateVoice = async () => {
    const clips = board.scenes
      .filter((scene) => scene.narration?.trim())
      .map((scene) => ({ id: scene.id, text: scene.narration!.trim() }));
    if (!clips.length) {
      setNotice({ kind: 'error', text: 'Add narration lines to your scenes first.' });
      return;
    }
    if (!hasElevenLabs) {
      setNotice({ kind: 'error', text: 'Add an ElevenLabs API key in Settings, then come back.' });
      return;
    }
    setBusy('voice');
    setNotice(null);
    try {
      const { clips: synthesized } = await api.voice({ voiceId: voiceId || undefined, scenes: clips });
      const measured = await Promise.all(
        synthesized.map(async (clip) => ({ id: clip.id, audio: clip.audio, seconds: await audioDuration(`/${clip.audio}`) })),
      );
      setBoard((current) => ({
        ...current,
        scenes: current.scenes.map((scene) => {
          const match = measured.find((item) => item.id === scene.id);
          if (!match) return scene;
          const seconds =
            match.seconds > 0
              ? Math.max(scene.seconds, Math.min(30, Math.round((match.seconds + 0.5) * 2) / 2))
              : scene.seconds;
          return { ...scene, audio: match.audio, seconds };
        }),
      }));
      setNotice({ kind: 'ok', text: `Voiceover generated for ${synthesized.length} scenes and scenes retimed to fit.` });
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const render = async () => {
    if (!board.scenes.length) {
      setNotice({ kind: 'error', text: 'Nothing to render yet.' });
      return;
    }
    setBusy('render');
    setProgress(0);
    setResult(null);
    setNotice(null);
    try {
      const output = await renderVideo(board, setProgress);
      setResult(output);
      persistProject(board, 'manual', output);
      setNotice({ kind: 'ok', text: `Rendered ${output.fileName}.` });
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const seekToScene = (index: number) => {
    playerRef.current?.seekTo(startFrameOf(previewBoard, index));
    playerRef.current?.play();
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-dim uppercase">{activeProjectId ? 'Video editor' : 'Create'}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{activeProjectId ? board.title : 'New creation'}</h1>
          <p className="mt-2 text-base text-dim">Start with a brief, shape your scenes, refine the vector art, and export the MP4.</p>
        </div>
        <Button variant="secondary" onClick={() => { setBoard(emptyStoryboard()); selectProject(null); setResult(null); }} icon={<Icon name="plus" />}>Start fresh</Button>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
      {/* ------------------------------- left rail ------------------------------ */}
      <div className="space-y-5">
        <Panel title="Brief" hint="One or two sentences is plenty.">
          <div className="space-y-3">
            <TextArea
              rows={5}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="A 30-second launch film for a self-hosted AI video studio. Confident, technical, no fluff. End with a call to action."
            />
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label>Length</Label>
                <Select value={targetSeconds} onChange={(event) => setTargetSeconds(Number(event.target.value))}>
                  {DURATIONS.map((duration) => (
                    <option key={duration} value={duration}>
                      ~{duration}s
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Scenes</Label>
                <Select value={sceneCount} onChange={(event) => setSceneCount(Number(event.target.value))}>
                  {SCENE_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count} scenes
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Aspect ratio</Label>
              <div className="flex gap-1 rounded-lg border border-line bg-ink-950/60 p-1">
                {ASPECTS.map((aspect) => (
                  <button
                    key={aspect}
                    type="button"
                    onClick={() => setBoard({ ...board, aspect: aspect as AspectId })}
                    className={cx(
                      'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                      board.aspect === aspect ? 'bg-ink-700 text-text' : 'text-dim hover:text-text',
                    )}
                  >
                    {aspect}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={withNarration}
                onChange={(event) => setWithNarration(event.target.checked)}
                className="size-3.5 accent-brand"
              />
              Write a voiceover script for each scene
            </label>
            <Button
              variant="primary"
              className="w-full"
              onClick={generate}
              loading={busy === 'plan'}
              icon={<Icon name="sparkles" />}
            >
              {busy === 'plan' ? 'Directing…' : 'Generate storyboard'}
            </Button>
            <p className="text-[11px] leading-relaxed text-dim">
              {settings?.ai.hasKey ? (
                <>
                  Using <span className="text-text">{settings.ai.model}</span> from your saved key.
                </>
              ) : (
                <>
                  No AI key yet — you still get an offline draft.{' '}
                  <a href="#/settings" className="text-brand-soft underline decoration-dotted">
                    Add one
                  </a>{' '}
                  for written scripts.
                </>
              )}
            </p>
          </div>
        </Panel>

        <Panel
          title="Skill"
          hint={`${SKILLS.length} art directions · ${skill.name} selected`}
          action={<Badge tone="accent">{skill.tags[0]}</Badge>}
        >
          <div className="grid grid-cols-2 gap-2">
            {SKILLS.map((item) => {
              const selected = item.id === board.skill;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBoard({ ...board, skill: item.id })}
                  title={item.blurb}
                  className={cx(
                    'group rounded-lg border p-2.5 text-left transition',
                    selected
                      ? 'border-brand/70 bg-ink-800/80 ring-2 ring-brand/25'
                      : 'border-line bg-ink-900/50 hover:border-line-bright hover:bg-ink-800/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-semibold text-text">{item.name}</span>
                    {selected ? <Icon name="check" className="size-3.5 text-brand-soft" /> : null}
                  </div>
                  <p className="line-clamp-2 mt-2 text-[10px] leading-snug text-dim">{item.blurb}</p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Storyboard"
          hint={board.scenes.length ? `${board.scenes.length} scenes · ${formatSeconds(totalSeconds(board))}` : 'Empty'}
          action={
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setBoard({ ...board, scenes: [] })} disabled={!board.scenes.length}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setBoard({ ...board, scenes: [...board.scenes, newScene()] })} icon={<Icon name="plus" />}>
                Scene
              </Button>
            </div>
          }
        >
          <SceneList storyboard={board} onChange={setBoard} openId={openScene} onOpen={setOpenScene} onSeek={seekToScene} />
        </Panel>
      </div>

      {/* -------------------------------- preview ------------------------------- */}
      <div className="space-y-5 lg:sticky lg:top-[76px]">
        <div className="rounded-xl border border-line bg-ink-900/70 p-3 shadow-panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Badge tone={isDemo ? 'warn' : 'accent'}>{isDemo ? 'Sample' : 'Live preview'}</Badge>
              <span className="text-[11px] text-dim">
                {previewBoard.title} · {previewSize.width}×{previewSize.height} · {formatSeconds(totalSeconds(previewBoard))}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {isDemo ? (
                <Button size="sm" onClick={() => { selectProject(null); setBoard(DEMO_STORYBOARD); }} icon={<Icon name="play" />}>
                  Load example
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mx-auto overflow-hidden rounded-lg border border-line bg-black" style={{ maxWidth: previewMaxWidth }}>
            <Player
              ref={playerRef}
              component={MotionGraphic}
              inputProps={{ storyboard: previewBoard }}
              durationInFrames={frames}
              compositionWidth={previewSize.width}
              compositionHeight={previewSize.height}
              fps={previewBoard.fps}
              initialFrame={Math.min(48, Math.max(0, frames - 1))}
              controls
              loop
              acknowledgeRemotionLicense
              style={{ width: '100%' }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-dim">
            <span>
              {skill.name} · {Math.round(frames / previewBoard.fps)}s · {previewBoard.fps}fps
            </span>
            <span className="hidden sm:inline">Click a scene number to jump</span>
          </div>
        </div>

        {notice ? (
          <Notice kind={notice.kind} onClose={() => setNotice(null)}>
            {notice.text}
          </Notice>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Voiceover" hint="ElevenLabs text to speech">
            <div className="space-y-3">
              {hasElevenLabs ? (
                <>
                  <div>
                    <Label hint={`${narrationCount} lines`}>Voice</Label>
                    {voices.length ? (
                      <Select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
                        {voices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                            {voice.accent ? ` — ${voice.accent}` : ''}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <TextInput value={voiceId} onChange={(event) => setVoiceId(event.target.value)} placeholder="Voice ID" />
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={generateVoice}
                    loading={busy === 'voice'}
                    disabled={narrationCount === 0}
                    icon={<Icon name="mic" />}
                  >
                    {busy === 'voice' ? 'Recording…' : 'Generate voiceover'}
                  </Button>
                  <p className="text-[11px] leading-relaxed text-dim">
                    Each scene gets its own clip and is retimed to fit the speech. Editing a narration line clears its audio.
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs leading-relaxed text-dim">
                    Add your ElevenLabs key to record narration per scene, with an automatic retime so nothing gets cut off.
                  </p>
                  <a href="#/settings">
                    <Button size="sm" icon={<Icon name="settings" />}>
                      Open settings
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Render" hint="MP4 · H.264 · AAC">
            <div className="space-y-3">
              <dl className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-ink-950/40 p-2.5 text-center">
                <div>
                  <dt className="text-[10px] tracking-wider text-dim uppercase">Scenes</dt>
                  <dd className="text-sm font-semibold">{board.scenes.length}</dd>
                </div>
                <div>
                  <dt className="text-[10px] tracking-wider text-dim uppercase">Length</dt>
                  <dd className="text-sm font-semibold">{formatSeconds(totalSeconds(board))}</dd>
                </div>
                <div>
                  <dt className="text-[10px] tracking-wider text-dim uppercase">Size</dt>
                  <dd className="text-sm font-semibold">{previewSize.height}p</dd>
                </div>
              </dl>

              <Button
                variant="primary"
                className="w-full"
                onClick={render}
                loading={busy === 'render'}
                disabled={!board.scenes.length}
                icon={<Icon name="film" />}
              >
                {busy === 'render' ? `Rendering ${Math.round(progress * 100)}%` : 'Render MP4'}
              </Button>

              {busy === 'render' ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
                    style={{ width: `${Math.max(2, progress * 100)}%` }}
                  />
                </div>
              ) : null}

              {result ? (
                <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/15 p-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Icon name="check" className="size-4 text-brand-soft" />
                    <span className="font-medium text-brand-soft">Ready</span>
                    <span className="text-dim">
                      {formatBytes(result.bytes)} · {(result.ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <a href={result.url} download={result.fileName} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full" icon={<Icon name="download" />}>
                        Download
                      </Button>
                    </a>
                    <a href={result.url} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full" icon={<Icon name="external" />}>
                        Open
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-dim">
                  Renders run on this machine with headless Chrome. The first render downloads the browser and warms the
                  bundle, so it takes a little longer.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
      </div>
    </div>
  );
};
