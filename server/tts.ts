import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';
import { AUDIO_DIR, readSettings } from './config';

const API = 'https://api.elevenlabs.io/v1';

export type Voice = { id: string; name: string; accent: string | null; description: string | null };

const failure = async (res: Response) => {
  const raw = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail)
      return String((detail as { message: unknown }).message);
  } catch {
    /* fall through */
  }
  return raw.slice(0, 300) || `ElevenLabs responded ${res.status}`;
};

const requireKey = () => {
  const { elevenlabs } = readSettings();
  if (!elevenlabs.apiKey)
    throw new Error('No ElevenLabs key saved. Add one in Settings, or set ELEVENLABS_API_KEY.');
  return elevenlabs;
};

export const listVoices = async (): Promise<{ voices: Voice[]; defaultVoiceId: string }> => {
  const config = requireKey();
  const res = await fetch(`${API}/voices`, {
    headers: { 'xi-api-key': config.apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(await failure(res));
  const json = (await res.json()) as {
    voices?: { voice_id: string; name: string; labels?: Record<string, string> }[];
  };
  const voices = (json.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    accent: voice.labels?.accent ?? null,
    description: [voice.labels?.description, voice.labels?.use_case].filter(Boolean).join(' · ') || null,
  }));
  return { voices, defaultVoiceId: config.voiceId };
};

export type SynthesizedClip = { id: string; audio: string; cached: boolean; seconds: number };
const inFlight = new Map<string, Promise<Buffer>>();
const duration = async (buffer: Buffer) => {
  const { format } = await parseBuffer(buffer, { mimeType: 'audio/mpeg' }, { duration: true });
  if (!format.duration || !Number.isFinite(format.duration))
    throw new Error('ElevenLabs returned unreadable audio. Try another voice.');
  return format.duration;
};

/** Synthesizes one clip per scene and returns public-dir paths for `staticFile`. */
export const synthesizeScenes = async (
  clips: { id: string; text: string }[],
  voiceIdOverride?: string,
): Promise<SynthesizedClip[]> => {
  const config = requireKey();
  const voiceId = voiceIdOverride?.trim() || config.voiceId;
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const results: SynthesizedClip[] = [];
  for (const clip of clips) {
    const text = clip.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const hash = crypto
      .createHash('sha1')
      .update(`${voiceId}|${config.modelId}|${config.stability}|${config.similarity}|${text}`)
      .digest('hex')
      .slice(0, 16);
    const fileName = `${hash}.mp3`;
    const target = path.join(AUDIO_DIR, fileName);
    const audio = `audio/${fileName}`;

    if (fs.existsSync(target) && fs.statSync(target).size > 512) {
      results.push({ id: clip.id, audio, cached: true, seconds: await duration(fs.readFileSync(target)) });
      continue;
    }

    let pending = inFlight.get(hash);
    if (!pending) {
      pending = (async () => {
        const res = await fetch(
          `${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'xi-api-key': config.apiKey },
            body: JSON.stringify({
              text,
              model_id: config.modelId,
              voice_settings: {
                stability: config.stability,
                similarity_boost: config.similarity,
                style: 0.15,
                use_speaker_boost: true,
              },
            }),
            signal: AbortSignal.timeout(120_000),
          },
        );

        if (!res.ok) throw new Error(await failure(res));
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.byteLength < 512)
          throw new Error('ElevenLabs returned an empty clip. Check the voice id.');
        await duration(buffer);
        const temp = `${target}.${crypto.randomUUID()}.tmp`;
        try {
          fs.writeFileSync(temp, buffer, { mode: 0o600 });
          fs.renameSync(temp, target);
        } finally {
          fs.rmSync(temp, { force: true });
        }
        return buffer;
      })().finally(() => inFlight.delete(hash));
      inFlight.set(hash, pending);
    }
    const buffer = await pending;
    results.push({ id: clip.id, audio, cached: false, seconds: await duration(buffer) });
  }
  return results;
};
