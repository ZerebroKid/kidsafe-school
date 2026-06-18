/**
 * Zumi AI proxy -- the ONLY place the Gemini API key is used.
 *
 * The child app never holds the key; it calls the `zumiConverse` /
 * `zumiEvaluateAnswer` callables, which call into here. The key is injected at
 * runtime via `defineSecret('GEMINI_API_KEY')` (same pattern as Razorpay in
 * `razorpay.ts`) so it never lives in source or in the client bundle.
 *
 * We use Gemini through its OpenAI-compatible Chat Completions endpoint, so the
 * request/response shape is the standard OpenAI one (system prompt folded into
 * `messages`, reply read from `choices[0].message.content`). Gemini is a strong
 * fit for Zumi's Hinglish + Indic-language tone and has a generous free tier.
 *
 * PRIVACY NOTE: this sends the child's first name + spoken answers to Gemini.
 * The free tier may use prompts to improve the product -- for production with
 * real children use a paid Gemini key / Vertex AI (no training on data), and/or
 * anonymise the name. `sanitizeName` already caps/cleans it.
 *
 * Two operations:
 *   - `converse()`  -- a short Hinglish chat turn (greeting, friendly chat,
 *     experiment follow-up, discovery validation, closing).
 *   - `evaluateAnswer()` -- grade a spoken quiz answer into
 *     correct|partial|incorrect + a 0/12/25 score, using JSON output mode with
 *     a keyword-match fallback so a malformed reply never crashes a quiz.
 *
 * Resilience: every request is wrapped in an AbortController timeout and a
 * single retry. Callers decide what to do on a thrown error (Zumi falls back
 * to a canned line and keeps the session moving -- a child is never stuck).
 */

import {defineSecret} from 'firebase-functions/params';

/** Gemini API key. Set once with: `firebase functions:secrets:set GEMINI_API_KEY`. */
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

/** Gemini's OpenAI-compatible Chat Completions endpoint. */
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// gemini-3.1-flash-lite: GA (May 2026), low-latency/low-cost, supports JSON
// structured output, free tier available. Replaces the retired
// gemini-2.0-flash-lite. If Google rotates the name, change ONLY this line.
const MODEL = 'gemini-3.1-flash-lite';
const REQUEST_TIMEOUT_MS = 12_000;

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export type EvalVerdict = 'correct' | 'partial' | 'incorrect';
export interface EvalResult {
  result: EvalVerdict;
  /** 25 correct, 12 partial, 0 incorrect. */
  score: number;
  reasoning: string;
}

interface OpenAIChatResponse {
  choices?: Array<{message?: {content?: string}}>;
}

interface CallOptions {
  maxTokens: number;
  temperature: number;
  /** When true, ask Gemini to emit a strict JSON object (used by the evaluator). */
  jsonMode?: boolean;
}

/** Map a verdict to its locked per-question score. */
export function scoreForVerdict(verdict: EvalVerdict): number {
  if (verdict === 'correct') return 25;
  if (verdict === 'partial') return 12;
  return 0;
}

/**
 * Low-level Gemini (OpenAI-compatible) call with timeout + one retry. Returns
 * the assistant message text. Throws on non-2xx or network/timeout after the
 * retry.
 */
async function callModel(
  messages: ChatTurn[],
  opts: CallOptions,
): Promise<string> {
  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY secret is not configured.');
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  };
  if (opts.jsonMode) {
    body.response_format = {type: 'json_object'};
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as OpenAIChatResponse;
      const reply = data.choices?.[0]?.message?.content ?? '';
      return reply.trim();
    } catch (err) {
      lastErr = err;
      // Only retry once, and only on the first attempt.
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini request failed.');
}

export interface ConverseParams {
  childName: string;
  grade: number;
  /** Stage-specific instruction injected into the system prompt. */
  context: string;
  /** Prior turns of THIS session's free-chat (kept short by the caller). */
  history: ChatTurn[];
}

/**
 * One Hinglish chat turn as Zumi. Keeps replies to 2-3 simple sentences. The
 * caller passes a `context` describing the current stage's intent; the last
 * turn in `history` should be the child's latest utterance (or no history yet,
 * e.g. the opening greeting).
 */
export async function converse(params: ConverseParams): Promise<string> {
  const {childName, grade, context, history} = params;
  const safeName = sanitizeName(childName);
  const system =
    `Tu Zumi hai -- ${safeName} ka pyaara AI dost. Wo class ${grade} mein hai. ` +
    `Hamesha Hinglish (Roman script) mein baat kar, max 2-3 chhote simple sentences. ` +
    `Warm, playful aur encouraging reh. Kabhi daanto mat. Koi emoji ya markdown mat use kar. ` +
    `Current goal: ${context}`;

  // OpenAI shape: system prompt is the first message. Seed a user nudge when
  // there's no child input yet (opening greeting) so the turn isn't empty.
  const messages: ChatTurn[] = [
    {role: 'system', content: system},
    ...(history.length > 0 ? history : [{role: 'user' as const, content: '(start)'}]),
  ];

  const reply = await callModel(messages, {maxTokens: 200, temperature: 0.8});
  return reply || '...';
}

export interface EvaluateParams {
  childName: string;
  grade: number;
  questionText: string;
  expectedConcepts: string[];
  correctIndicator: string;
  transcript: string;
}

/**
 * Grade one spoken answer. Returns a strict {result, score, reasoning}. A
 * blank transcript short-circuits to incorrect. If the model returns
 * non-JSON, we fall back to a keyword match against `expectedConcepts`.
 */
export async function evaluateAnswer(params: EvaluateParams): Promise<EvalResult> {
  const {grade, questionText, expectedConcepts, correctIndicator, transcript} =
    params;

  const clean = (transcript ?? '').trim();
  if (clean.length === 0) {
    return {result: 'incorrect', score: 0, reasoning: 'No answer captured.'};
  }

  const prompt =
    `A class ${grade} child was asked (Hinglish): "${questionText}".\n` +
    `Concepts a good answer includes: ${JSON.stringify(expectedConcepts)}.\n` +
    `What counts as correct: "${correctIndicator}".\n` +
    `The child said: "${clean}".\n` +
    `Be lenient with spelling, Hinglish, and child phrasing -- judge the idea, not the words. ` +
    `Reply with ONLY compact JSON, no prose: ` +
    `{"result":"correct"|"partial"|"incorrect","score":25|12|0,"reasoning":"<short>"}`;

  try {
    const raw = await callModel([{role: 'user', content: prompt}], {
      maxTokens: 120,
      temperature: 0.1,
      jsonMode: true,
    });
    const parsed = parseEval(raw);
    if (parsed) return parsed;
  } catch {
    // fall through to keyword fallback
  }
  return keywordFallback(clean, expectedConcepts);
}

/** Best-effort JSON extraction from a model reply. */
function parseEval(raw: string): EvalResult | null {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      result?: unknown;
      reasoning?: unknown;
    };
    const result =
      obj.result === 'correct' || obj.result === 'partial' ? obj.result : 'incorrect';
    return {
      result,
      score: scoreForVerdict(result),
      reasoning:
        typeof obj.reasoning === 'string' ? obj.reasoning.slice(0, 280) : 'ai',
    };
  } catch {
    return null;
  }
}

/** Deterministic fallback: any expected concept mentioned => correct. */
function keywordFallback(transcript: string, concepts: string[]): EvalResult {
  const hay = transcript.toLowerCase();
  const hit = concepts.some(c => c && hay.includes(c.toLowerCase()));
  const result: EvalVerdict = hit ? 'correct' : 'incorrect';
  return {
    result,
    score: scoreForVerdict(result),
    reasoning: 'keyword-fallback',
  };
}

/** Strip anything weird from the child's name before putting it in a prompt. */
function sanitizeName(name: string): string {
  const trimmed = (name ?? '').trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : 'dost';
}
