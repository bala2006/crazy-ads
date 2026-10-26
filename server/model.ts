import { readSettings } from './config';
import type { ImageReference } from './images';

export type ModelUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type ModelReply = { value: unknown; usage?: ModelUsage };

/** Only text JSON is produced. Reference images are sent to a vision-capable text model. */
export const completeJson = async (
  system: string,
  prompt: string,
  references: ImageReference[] = [],
): Promise<ModelReply> => {
  const { ai } = readSettings();
  if (!ai.apiKey) throw new Error('Add a text-model API key in Settings to use the AI editor.');
  const url = new URL(`${ai.baseUrl.replace(/\/+$/, '')}/chat/completions`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Use an OpenAI-compatible base URL without credentials, query, or fragment.');
  if ((process.env.NODE_ENV === 'production' || process.argv.includes('--prod')) && url.protocol !== 'https:')
    throw new Error('Production AI providers must use HTTPS.');
  const body: Record<string, unknown> = {
    model: ai.model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: references.length
          ? [
              { type: 'text', text: prompt },
              ...references.map((ref) => ({
                type: 'image_url',
                image_url: { url: ref.dataUrl, detail: 'auto' },
              })),
            ]
          : prompt,
      },
    ],
  };
  // Reasoning models may reject temperature. Omitting it is portable across providers.
  const call = async () => {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string; param?: string };
    } | null;
    return { res, payload };
  };
  let { res, payload } = await call();
  // Retry only explicit JSON-format incompatibility, never billing/auth/network failures.
  if (
    !res.ok &&
    [400, 422].includes(res.status) &&
    /response_format|json_object/i.test(`${payload?.error?.param} ${payload?.error?.message}`)
  ) {
    delete body.response_format;
    ({ res, payload } = await call());
  }
  if (!res.ok)
    throw new Error(
      `Text provider returned ${res.status}. ${res.status === 401 ? 'Check your API key.' : res.status === 429 ? 'Check your quota or retry later.' : 'Check the model, vision support, and base URL in Settings.'}`,
    );
  if (payload?.choices?.[0]?.finish_reason === 'length')
    throw new Error(
      'The model response was incomplete. Ask for fewer scenes or use a model with a larger output allowance.',
    );
  const content = payload?.choices?.[0]?.message?.content?.trim() || '';
  const text = content.match(/^```(?:json)?\s*([\s\S]*?)```$/i)?.[1] || content;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The model returned invalid JSON. Your project has not changed. Try again.');
  }
  const usage = payload?.usage;
  return {
    value,
    ...(usage && Number.isFinite(usage.prompt_tokens) && Number.isFinite(usage.completion_tokens)
      ? {
          usage: {
            inputTokens: usage.prompt_tokens!,
            outputTokens: usage.completion_tokens!,
            totalTokens: usage.total_tokens ?? usage.prompt_tokens! + usage.completion_tokens!,
          },
        }
      : {}),
  };
};
