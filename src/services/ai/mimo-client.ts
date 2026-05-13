// ============================================================
// KodaiRateIQ — MiMo AI Client
// OpenAI-compatible client for Xiaomi MiMo AI Platform
// Endpoint: https://token-plan-sgp.xiaomimimo.com/v1
// ============================================================

const MIMO_BASE_URL = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT || '45000', 10);
const AI_MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || '3', 10);

export interface MiMoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MiMoRequestOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
  systemPrompt?: string;
}

export interface MiMoResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export class MiMoError extends Error {
  constructor(
    message: string,
    public readonly code: 'timeout' | 'rate_limit' | 'invalid_response' | 'api_error' | 'auth_error',
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'MiMoError';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MiMoError(`MiMo API request timed out after ${timeoutMs}ms`, 'timeout', undefined, true);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeError(err: unknown, attempt: number): MiMoError {
  if (err instanceof MiMoError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new MiMoError(`MiMo API error on attempt ${attempt}: ${msg}`, 'api_error', undefined, true);
}

export async function mimoChat(
  messages: MiMoMessage[],
  options: MiMoRequestOptions = {}
): Promise<MiMoResponse> {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new MiMoError('MIMO_API_KEY is not configured', 'auth_error', 401, false);

  const {
    temperature = 0.3,
    maxTokens = 4096,
    responseFormat = 'json_object',
  } = options;

  const body = JSON.stringify({
    model: MIMO_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
  });

  let lastError: MiMoError | null = null;

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    const startMs = Date.now();
    try {
      const response = await fetchWithTimeout(
        `${MIMO_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
          body,
        },
        AI_TIMEOUT
      );

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        const waitMs = Math.min(retryAfter * 1000, 30000);
        console.warn(`[MiMo] Rate limited. Waiting ${waitMs}ms before retry ${attempt}/${AI_MAX_RETRIES}`);
        await sleep(waitMs);
        lastError = new MiMoError('Rate limit exceeded', 'rate_limit', 429, true);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new MiMoError('MiMo API authentication failed — check MIMO_API_KEY', 'auth_error', response.status, false);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        const retryable = response.status >= 500;
        const err = new MiMoError(
          `MiMo API returned HTTP ${response.status}: ${errorText}`,
          'api_error',
          response.status,
          retryable
        );
        if (!retryable) throw err;
        lastError = err;
        await sleep(attempt * 2000);
        continue;
      }

      const json = await response.json();

      const choice = json.choices?.[0];
      if (!choice?.message?.content) {
        throw new MiMoError('MiMo API returned empty response content', 'invalid_response', undefined, true);
      }

      return {
        content: choice.message.content,
        model: json.model || MIMO_MODEL,
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
        },
        durationMs: Date.now() - startMs,
      };
    } catch (err) {
      const normalized = normalizeError(err, attempt);
      if (!normalized.retryable) throw normalized;
      lastError = normalized;
      console.error(`[MiMo] Attempt ${attempt}/${AI_MAX_RETRIES} failed: ${normalized.message}`);
      if (attempt < AI_MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError ?? new MiMoError('MiMo API failed after all retries', 'api_error', undefined, false);
}

export async function mimoChatJson<T>(
  messages: MiMoMessage[],
  options: MiMoRequestOptions = {}
): Promise<{ data: T; meta: Omit<MiMoResponse, 'content'> }> {
  const response = await mimoChat(messages, { ...options, responseFormat: 'json_object' });

  let parsed: T;
  try {
    parsed = JSON.parse(response.content) as T;
  } catch {
    // Sometimes the model wraps JSON in markdown code fences
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]) as T;
      } catch {
        throw new MiMoError(
          `MiMo returned non-parseable JSON: ${response.content.slice(0, 200)}`,
          'invalid_response',
          undefined,
          false
        );
      }
    } else {
      throw new MiMoError(
        `MiMo returned non-parseable JSON: ${response.content.slice(0, 200)}`,
        'invalid_response',
        undefined,
        false
      );
    }
  }

  const { content: _, ...meta } = response;
  return { data: parsed, meta };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isMiMoConfigured(): boolean {
  return Boolean(process.env.MIMO_API_KEY);
}
