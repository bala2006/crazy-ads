import React, { useEffect, useState } from 'react';
import { Badge, Button, Icon, Label, Notice, Panel, Select, TextInput, cx } from './components';
import { api, type PublicSettings, type Voice } from './lib/api';

const AI_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
];

const VOICE_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — best quality' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 — fast & cheaper' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — fastest' },
];

type Notice_ = { kind: 'info' | 'ok' | 'error'; text: string };

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [notice, setNotice] = useState<Notice_ | null>(null);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);

  const [ai, setAi] = useState({ baseUrl: '', model: '', temperature: 0.85, apiKey: '' });
  const [el, setEl] = useState({ voiceId: '', modelId: 'eleven_multilingual_v2', stability: 0.45, similarity: 0.75, apiKey: '' });
  const [render, setRender] = useState({ concurrency: 2, crf: 23 });

  const hydrate = (next: PublicSettings) => {
    setSettings(next);
    setAi({ baseUrl: next.ai.baseUrl, model: next.ai.model, temperature: next.ai.temperature, apiKey: '' });
    setEl({
      voiceId: next.elevenlabs.voiceId,
      modelId: next.elevenlabs.modelId,
      stability: next.elevenlabs.stability,
      similarity: next.elevenlabs.similarity,
      apiKey: '',
    });
    setRender(next.render);
  };

  useEffect(() => {
    api
      .settings()
      .then(hydrate)
      .catch((error: Error) => setNotice({ kind: 'error', text: error.message }));
  }, []);

  useEffect(() => {
    if (!settings?.elevenlabs.hasKey) return;
    api
      .voices()
      .then((response) => setVoices(response.voices))
      .catch(() => undefined);
  }, [settings?.elevenlabs.hasKey]);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const next = await api.saveSettings({
        ai: {
          baseUrl: ai.baseUrl.trim(),
          model: ai.model.trim(),
          temperature: ai.temperature,
          ...(ai.apiKey.trim() ? { apiKey: ai.apiKey.trim() } : {}),
        },
        elevenlabs: {
          voiceId: el.voiceId.trim(),
          modelId: el.modelId,
          stability: el.stability,
          similarity: el.similarity,
          ...(el.apiKey.trim() ? { apiKey: el.apiKey.trim() } : {}),
        },
        render,
      });
      hydrate(next);
      setNotice({ kind: 'ok', text: 'Settings saved to .data/config.json.' });
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (provider: 'ai' | 'elevenlabs') => {
    try {
      hydrate(await api.clearKey(provider));
      setNotice({ kind: 'info', text: `${provider === 'ai' ? 'AI' : 'ElevenLabs'} key removed.` });
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    }
  };

  const fetchVoices = async () => {
    try {
      const response = await api.voices();
      setVoices(response.voices);
      setNotice({ kind: 'ok', text: `Loaded ${response.voices.length} voices.` });
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-dim">
            Keys are stored server-side in <code className="rounded bg-ink-800 px-1 py-0.5 text-[12px]">.data/config.json</code> and
            never sent to the browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="#/studio">
            <Button variant="ghost" size="sm">
              Back to studio
            </Button>
          </a>
          <Button variant="primary" onClick={save} loading={saving} icon={<Icon name="check" />}>
            Save changes
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="mb-4">
          <Notice kind={notice.kind} onClose={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      ) : null}

      <div className="space-y-5">
        <Panel
          title="AI provider"
          hint="Any OpenAI-compatible chat completions endpoint"
          action={
            settings?.ai.hasKey ? <Badge tone="ok">key {settings.ai.keyHint}</Badge> : <Badge tone="warn">not configured</Badge>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {AI_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAi({ ...ai, baseUrl: preset.baseUrl, model: preset.model })}
                  className={cx(
                    'rounded-full border px-2.5 py-1 text-[11px] transition',
                    ai.baseUrl === preset.baseUrl
                      ? 'border-brand/60 bg-brand/15 text-brand-soft'
                      : 'border-line text-dim hover:border-line-bright hover:text-text',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Base URL</Label>
                <TextInput value={ai.baseUrl} onChange={(event) => setAi({ ...ai, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" spellCheck={false} />
              </div>
              <div>
                <Label>Model</Label>
                <TextInput value={ai.model} onChange={(event) => setAi({ ...ai, model: event.target.value })} placeholder="gpt-4o-mini" spellCheck={false} />
              </div>
            </div>

            <div>
              <Label hint={settings?.ai.keyHint ? `saved: ${settings.ai.keyHint}` : 'required'}>API key</Label>
              <div className="flex gap-2">
                <TextInput
                  type="password"
                  value={ai.apiKey}
                  onChange={(event) => setAi({ ...ai, apiKey: event.target.value })}
                  placeholder={settings?.ai.hasKey ? 'Leave blank to keep the saved key' : 'sk-…'}
                  autoComplete="off"
                  spellCheck={false}
                />
                {settings?.ai.hasKey ? (
                  <Button variant="danger" size="sm" onClick={() => removeKey('ai')}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <div>
              <Label hint={`${ai.temperature.toFixed(2)} · higher is wilder`}>Creativity</Label>
              <input
                type="range"
                min={0}
                max={1.4}
                step={0.05}
                value={ai.temperature}
                onChange={(event) => setAi({ ...ai, temperature: Number(event.target.value) })}
                className="w-full accent-[#7c5cff]"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-dim">
              For a local model (Ollama, LM Studio) enter the OpenAI-compatible base URL and any placeholder key — the server
              only needs the endpoint to be reachable.
            </p>
          </div>
        </Panel>

        <Panel
          title="ElevenLabs voiceover"
          hint="Text to speech, one clip per scene"
          action={
            settings?.elevenlabs.hasKey ? (
              <Badge tone="ok">key {settings.elevenlabs.keyHint}</Badge>
            ) : (
              <Badge tone="warn">not configured</Badge>
            )
          }
        >
          <div className="space-y-3">
            <div>
              <Label hint={settings?.elevenlabs.keyHint ? `saved: ${settings.elevenlabs.keyHint}` : 'required'}>API key</Label>
              <div className="flex gap-2">
                <TextInput
                  type="password"
                  value={el.apiKey}
                  onChange={(event) => setEl({ ...el, apiKey: event.target.value })}
                  placeholder={settings?.elevenlabs.hasKey ? 'Leave blank to keep the saved key' : 'sk_…'}
                  autoComplete="off"
                  spellCheck={false}
                />
                {settings?.elevenlabs.hasKey ? (
                  <Button variant="danger" size="sm" onClick={() => removeKey('elevenlabs')}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label hint={voices.length ? `${voices.length} available` : 'voice id'}>Voice</Label>
                {voices.length ? (
                  <Select value={el.voiceId} onChange={(event) => setEl({ ...el, voiceId: event.target.value })}>
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                        {voice.accent ? ` — ${voice.accent}` : ''}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <TextInput value={el.voiceId} onChange={(event) => setEl({ ...el, voiceId: event.target.value })} placeholder="Voice ID" spellCheck={false} />
                    <Button size="sm" onClick={fetchVoices} disabled={!settings?.elevenlabs.hasKey}>
                      Fetch
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label>Model</Label>
                <Select value={el.modelId} onChange={(event) => setEl({ ...el, modelId: event.target.value })}>
                  {VOICE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label hint={el.stability.toFixed(2)}>Stability</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={el.stability}
                  onChange={(event) => setEl({ ...el, stability: Number(event.target.value) })}
                  className="w-full accent-[#7c5cff]"
                />
              </div>
              <div>
                <Label hint={el.similarity.toFixed(2)}>Similarity</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={el.similarity}
                  onChange={(event) => setEl({ ...el, similarity: Number(event.target.value) })}
                  className="w-full accent-[#7c5cff]"
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Rendering" hint="Applies to every MP4 the studio produces">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label hint="parallel browser tabs">Concurrency</Label>
              <Select value={render.concurrency} onChange={(event) => setRender({ ...render, concurrency: Number(event.target.value) })}>
                {[1, 2, 3, 4, 6, 8].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label hint="lower = better quality">CRF</Label>
              <Select value={render.crf} onChange={(event) => setRender({ ...render, crf: Number(event.target.value) })}>
                {[18, 20, 23, 26, 28].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Panel>

        <Panel title="Environment" hint="Prefer env vars? They override the defaults.">
          <div className="space-y-2 text-xs leading-relaxed text-dim">
            <p>
              <code className="rounded bg-ink-800 px-1 py-0.5">AI_API_KEY</code>,{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">AI_BASE_URL</code>,{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">AI_MODEL</code>,{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">ELEVENLABS_API_KEY</code>,{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">ELEVENLABS_VOICE_ID</code>,{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">PORT</code>
            </p>
            <p>
              Runtime: Node {settings?.runtime.node ?? '—'}. Generated audio lands in{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">public/audio</code>, renders in{' '}
              <code className="rounded bg-ink-800 px-1 py-0.5">public/renders</code> (pruned after 24h).
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
};
