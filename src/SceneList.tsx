import React, { useEffect, useRef, useState } from 'react';
import {
  LAYOUTS,
  LAYOUT_LABELS,
  TRANSITIONS,
  VISUAL_MOTIONS,
  type LayoutId,
  type Scene,
  type Storyboard,
  type TransitionId,
} from './remotion/types';
import { Badge, Button, Icon, Label, Select, TextArea, TextInput, cx } from './components';
import { sanitizeInlineSvg } from './lib/svg';

type Props = {
  storyboard: Storyboard;
  onChange: (storyboard: Storyboard) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onSeek: (index: number) => void;
};

const ItemsField: React.FC<{ initial: string[]; onCommit: (items: string[]) => void }> = ({
  initial,
  onCommit,
}) => {
  const [text, setText] = useState(initial.join('\n'));
  const emitted = useRef(initial.join('\n'));
  const serialized = initial.join('\n');
  useEffect(() => {
    if (emitted.current !== serialized) {
      setText(serialized);
      emitted.current = serialized;
    }
  }, [serialized]);
  return (
    <TextArea
      rows={3}
      value={text}
      placeholder={'One item per line'}
      onChange={(event) => {
        setText(event.target.value);
        const items = event.target.value
          .split('\n')
          .map((line) => line.trim().slice(0, 160))
          .filter(Boolean)
          .slice(0, 6);
        emitted.current = items.join('\n');
        onCommit(items);
      }}
    />
  );
};

export const SceneEditor: React.FC<{ scene: Scene; patch: (patch: Partial<Scene>) => void }> = ({
  scene,
  patch,
}) => {
  const supportsItems = scene.layout === 'bullets' || scene.layout === 'split' || scene.layout === 'outro';
  const vectorValid = !scene.visualSvg || Boolean(sanitizeInlineSvg(scene.visualSvg));
  return (
    <div className="grid gap-2.5 border-t border-line/70 px-2.5 pt-3 pb-3 sm:grid-cols-2">
      <div>
        <Label>Layout</Label>
        <Select
          aria-label="Scene layout"
          value={scene.layout}
          onChange={(event) => patch({ layout: event.target.value as LayoutId })}
        >
          {LAYOUTS.map((layout) => (
            <option key={layout} value={layout}>
              {LAYOUT_LABELS[layout]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label hint="seconds">Duration</Label>
        <TextInput
          type="number"
          aria-label="Scene duration"
          min={1.5}
          max={30}
          step={0.5}
          value={scene.seconds}
          onChange={(event) =>
            patch({ seconds: Math.min(30, Math.max(1.5, Number(event.target.value) || 1.5)) })
          }
        />
      </div>
      <div className="sm:col-span-2">
        <Label hint="small label above the headline">Kicker</Label>
        <TextInput
          aria-label="Kicker"
          maxLength={80}
          value={scene.kicker ?? ''}
          placeholder="e.g. The workflow"
          onChange={(event) => patch({ kicker: event.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label hint="use a new line to break the line">Headline</Label>
        <TextArea
          rows={2}
          aria-label="Scene headline"
          maxLength={200}
          value={scene.headline}
          onChange={(event) => patch({ headline: event.target.value })}
        />
      </div>
      <div className={scene.layout === 'stat' ? '' : 'sm:col-span-2'}>
        <Label>Sub line</Label>
        <TextInput
          aria-label="Supporting line"
          maxLength={300}
          value={scene.sub ?? ''}
          placeholder="Supporting line"
          onChange={(event) => patch({ sub: event.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <details>
          <summary className="mb-2 cursor-pointer text-xs font-semibold">
            Vector illustration · advanced
          </summary>
          <Label hint="passive SVG">Vector illustration</Label>
          <TextArea
            rows={6}
            value={scene.visualSvg ?? ''}
            placeholder={
              '<svg viewBox="0 0 400 400">\n  <circle cx="200" cy="200" r="120" fill="#2b2823" />\n</svg>'
            }
            spellCheck={false}
            onChange={(event) => patch({ visualSvg: event.target.value || undefined })}
            className="font-mono text-xs"
          />
          <p className={`mt-1 text-[11px] ${vectorValid ? 'text-dim' : 'text-text'}`}>
            {vectorValid
              ? 'Use the Split layout to place vector art next to your text.'
              : 'Invalid SVG. Finish the markup before exporting.'}
          </p>
        </details>
        <Label>Vector motion</Label>
        <Select
          aria-label="Vector motion"
          value={scene.visualMotion || 'float'}
          onChange={(event) => patch({ visualMotion: event.target.value as Scene['visualMotion'] })}
        >
          {VISUAL_MOTIONS.map((motion) => (
            <option key={motion}>{motion}</option>
          ))}
        </Select>
        <Label>Accent color</Label>
        <input
          aria-label="Accent color"
          type="color"
          value={scene.accent || '#5c9d78'}
          onChange={(event) => patch({ accent: event.target.value })}
        />
      </div>
      {scene.layout === 'stat' ? (
        <div>
          <Label hint="e.g. 12x">Big value</Label>
          <TextInput
            aria-label="Value"
            maxLength={24}
            value={scene.value ?? ''}
            placeholder="12x"
            onChange={(event) => patch({ value: event.target.value })}
          />
        </div>
      ) : null}
      {supportsItems ? (
        <div className="sm:col-span-2">
          <Label
            hint={scene.layout === 'outro' ? 'first item becomes the CTA button' : 'one per line, max 6'}
          >
            {scene.layout === 'outro' ? 'Call to action' : 'Items'}
          </Label>
          <ItemsField key={scene.id} initial={scene.items ?? []} onCommit={(items) => patch({ items })} />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Label hint="spoken by ElevenLabs">Narration</Label>
        <TextArea
          rows={2}
          aria-label="Narration"
          maxLength={600}
          value={scene.narration ?? ''}
          placeholder="What the voiceover says in this scene"
          onChange={(event) => patch({ narration: event.target.value, audio: undefined })}
        />
      </div>
      <div>
        <Label>Exit transition</Label>
        <Select
          aria-label="Scene transition"
          value={scene.transition}
          onChange={(event) => patch({ transition: event.target.value as TransitionId })}
        >
          {TRANSITIONS.map((transition) => (
            <option key={transition} value={transition}>
              {transition}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export const SceneList: React.FC<Props> = ({ storyboard, onChange, openId, onOpen, onSeek }) => {
  const { scenes } = storyboard;

  const patchScene = (id: string, patch: Partial<Scene>) =>
    onChange({
      ...storyboard,
      scenes: scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)),
    });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    const next = [...scenes];
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    onChange({ ...storyboard, scenes: next });
  };

  const remove = (id: string) =>
    onChange({ ...storyboard, scenes: scenes.filter((scene) => scene.id !== id) });

  const duplicate = (scene: Scene) => {
    const index = scenes.findIndex((item) => item.id === scene.id);
    const copy: Scene = { ...scene, id: `${scene.id}-copy-${Date.now().toString(36)}`, audio: undefined };
    const next = [...scenes];
    next.splice(index + 1, 0, copy);
    onChange({ ...storyboard, scenes: next });
  };

  if (!scenes.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
        <Icon name="film" className="mx-auto size-6 text-dim" />
        <p className="mt-2 text-sm font-medium">No scenes yet</p>
        <p className="mt-1 text-xs text-dim">
          Write a brief and generate a storyboard, or add scenes by hand.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              onChange({
                ...storyboard,
                scenes: [
                  {
                    id: `s-${Date.now()}`,
                    layout: 'hero',
                    headline: 'Your headline',
                    seconds: 4,
                    transition: 'fade',
                  },
                ],
              })
            }
          >
            <Icon name="plus" /> Add first scene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {scenes.map((scene, index) => {
        const open = openId === scene.id;
        return (
          <div
            key={scene.id}
            className={cx(
              'rounded-lg border transition-colors',
              open ? 'border-brand/45 bg-ink-800/50' : 'border-line bg-ink-900/40 hover:border-line-bright',
            )}
          >
            <div className="flex items-start gap-2 p-2.5">
              <button
                type="button"
                onClick={() => onSeek(index)}
                title={`Play from scene ${index + 1}`}
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-ink-950/70 text-[11px] font-semibold text-dim transition hover:border-brand/50 hover:text-brand-soft"
              >
                {index + 1}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{LAYOUT_LABELS[scene.layout]}</Badge>
                  <span className="text-[10px] text-dim">{scene.seconds}s</span>
                  {scene.audio ? <Badge tone="ok">voice</Badge> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(open ? null : scene.id)}
                  className="line-clamp-2 mt-1 w-full text-left text-sm leading-snug font-medium text-text"
                >
                  {scene.headline.replace(/\n/g, ' ')}
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded p-1 text-dim transition hover:bg-ink-700 hover:text-text disabled:opacity-25"
                  aria-label="Move up"
                >
                  <Icon name="up" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === scenes.length - 1}
                  className="rounded p-1 text-dim transition hover:bg-ink-700 hover:text-text disabled:opacity-25"
                  aria-label="Move down"
                >
                  <Icon name="down" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(scene)}
                  className="rounded p-1 text-dim transition hover:bg-ink-700 hover:text-text"
                  aria-label="Duplicate"
                >
                  <Icon name="copy" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(scene.id)}
                  className="rounded p-1 text-dim transition hover:bg-ink-800 hover:text-text"
                  aria-label="Delete"
                >
                  <Icon name="trash" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(open ? null : scene.id)}
                  className="ml-1 rounded px-1.5 py-1 text-[10px] font-semibold tracking-wider text-dim uppercase transition hover:bg-ink-700 hover:text-text"
                >
                  {open ? 'Close' : 'Edit'}
                </button>
              </div>
            </div>
            {open ? <SceneEditor scene={scene} patch={(patch) => patchScene(scene.id, patch)} /> : null}
          </div>
        );
      })}
    </div>
  );
};
