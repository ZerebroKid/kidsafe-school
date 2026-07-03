/**
 * Zumi AI proxy -- the ONLY place the OpenAI API key is used.
 *
 * The child app never holds the key; it calls the `zumiConverse` / `zumiTeach` /
 * `zumiEvaluateAnswer` callables, which call into here. The key is injected at
 * runtime from `process.env.OPENAI_API_KEY`, populated via a `.env` file in
 * the functions project root (Firebase Functions v2 loads it automatically
 * on deploy and in the emulator -- no Secret Manager binding needed).
 *
 * We use the official `openai` SDK (Chat Completions). gpt-4o-mini is a strong,
 * fast, low-cost fit for Zumi's Hinglish + Indic tone and supports JSON
 * structured output (used by the evaluator + the adaptive teaching director).
 *
 * PRIVACY NOTE: this sends the child's first name + spoken answers to OpenAI.
 * For production with real children use an enterprise/no-training agreement
 * and/or anonymise the name. `sanitizeName` already caps/cleans it.
 *
 * Three operations:
 *   - `converse()`   -- a short Hinglish chat turn (greeting, closing).
 *   - `teachTurn()`  -- one turn of the adaptive, stealth-teaching conversation.
 *     Returns a structured {say, phase, animationHint} so the on-device manager
 *     can drive animations and know when the concept is taught (-> quiz).
 *   - `evaluateAnswer()` -- grade a spoken quiz answer into
 *     correct|partial|incorrect + a 0/12/25 score, using JSON output mode with
 *     a keyword-match fallback so a malformed reply never crashes a quiz.
 *
 * Resilience: every request uses the SDK's timeout + one retry. Callers decide
 * what to do on a thrown error (Zumi falls back to a canned line and keeps the
 * session moving -- a child is never stuck).
 */

import OpenAI from 'openai';

// gpt-4o-mini: fast, low-cost, strong Hinglish, supports JSON structured output.
// Override via `LLM_MODEL` in .env without a code change (e.g. 'gpt-4.1-mini').
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
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
  /** Warm Hinglish spoken line Zumi says back, tuned to the verdict + answer. */
  feedback: string;
}

/** Lazy OpenAI client. The key is only available at runtime via process.env. */
let clientSingleton: OpenAI | null = null;
function client(): OpenAI {
  if (clientSingleton) return clientSingleton;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Check your .env file.');
  }
  clientSingleton = new OpenAI({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  return clientSingleton;
}

/** Map a verdict to its locked per-question score. */
export function scoreForVerdict(verdict: EvalVerdict): number {
  if (verdict === 'correct') return 25;
  if (verdict === 'partial') return 12;
  return 0;
}

export interface ConverseParams {
  childName: string;
  grade: number;
  /** Stage-specific instruction injected into the system prompt. */
  context: string;
  /** Prior turns of THIS session's chat (kept short by the caller). */
  history: ChatTurn[];
}

/**
 * One Hinglish chat turn as Zumi. Keeps replies to 2-3 simple sentences. The
 * caller passes a `context` describing the current stage's intent; the last
 * turn in `history` should be the child's latest utterance (or no history yet,
 * e.g. the opening greeting).
 */
export async function converse(params: ConverseParams): Promise<string> {
  const { childName, grade, context, history } = params;
  const safeName = sanitizeName(childName);
  const nameClause = safeName
    ? `${safeName} ka pyaara AI dost`
    : `ek bachche ka pyaara AI dost (tujhe abhi bachche ka naam nahi pata -- pehle unse puchh aur fir uska naam use kar)`;
  const system =
    `Tu Zumi hai -- ${nameClause}. Wo class ${grade} mein hai. ` +
    `Hamesha Hinglish (Roman script) mein baat kar, max 1-2 chhote simple sentences (strictly under 100 characters). ` +
    `Warm, playful aur encouraging reh. Kabhi daanto mat. Koi emoji ya markdown mat use kar. ` +
    `Current goal: ${context}`;

  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    ...(history.length > 0
      ? history
      : [{ role: 'user' as const, content: '(start)' }]),
  ];

  const res = await client().chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 100,
    temperature: 0.85,
  });
  const reply = res.choices?.[0]?.message?.content?.trim() ?? '';
  return reply || '...';
}

/** The teaching phases the director moves through, in order. */
export type TeachPhase =
  | 'warmup'
  | 'hook'
  | 'explore'
  | 'explain'
  | 'check'
  | 'ready_for_quiz';

/** Generic animation categories the director can request. */
export type AnimationHint =
  | 'none'
  | 'experiment'
  | 'visualize'
  | 'reveal'
  | 'celebrate'
  | 'trap';

export interface TeachMaterial {
  topicName: string;
  /** Real-life mystery/story hook to open with. */
  hookContext: string;
  /** A prediction prompt to make the child guess. */
  predictContext: string;
  /** A small hands-on experiment the child can do. */
  experimentInstruction: string;
  /** The plain-language concept reveal (what the child should end up understanding). */
  conceptRevealScript: string;
  /** NCERT-language definition (the exam-accurate phrasing). */
  ncertDefinition: string;
  /** Bullet key points the child must hear. */
  keyPoints: string[];
  /** Keywords to slip in naturally. */
  keywords: string[];
  /** A mnemonic / memory trick. */
  memoryTrick: string;
}

export interface TeachParams {
  childName: string;
  grade: number;
  material: TeachMaterial;
  /** The phase the conversation is currently in (the model may advance it). */
  phase: TeachPhase;
  /** Running conversation so far (caller keeps a healthy window). */
  history: ChatTurn[];
}

export interface TeachResult {
  say: string;
  phase: TeachPhase;
  animationHint: AnimationHint;
}

const TEACH_SCHEMA = {
  name: 'zumi_turn',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      say: {
        type: 'string',
        description:
          "Zumi's next spoken line in Hinglish (Roman script), 1-3 short simple sentences, ending with exactly one question or invitation to respond.",
      },
      phase: {
        type: 'string',
        enum: ['warmup', 'hook', 'explore', 'explain', 'check', 'ready_for_quiz'],
        description:
          'The teaching phase AFTER this line. Advance only when the current phase goal is met. Use ready_for_quiz only once the child clearly understands the concept AND has heard the memory trick.',
      },
      animationHint: {
        type: 'string',
        enum: ['none', 'experiment', 'visualize', 'reveal', 'celebrate', 'trap'],
        description:
          'Optional visual to play with this line. experiment=hands-on activity, visualize=show the idea, reveal=concept reveal, celebrate=child did great, trap=playful wrong-idea bust, none=just talk.',
      },
    },
    required: ['say', 'phase', 'animationHint'],
  },
} as const;

/**
 * One turn of the adaptive, stealth-teaching conversation. The director chats
 * like a friend and slips the topic into the conversation so the child never
 * feels they are studying -- yet still ends up understanding the concept and
 * hearing the memory trick before the quiz. The topic content is supplied as
 * KNOWLEDGE/GOALS, never as a script to read verbatim.
 */
export async function teachTurn(params: TeachParams): Promise<TeachResult> {
  const { childName, grade, material, phase, history } = params;
  const safeName = sanitizeName(childName);
  const nameClause = safeName
    ? `Bachche ka naam ${safeName} hai.`
    : `Tujhe bachche ka naam abhi nahi pata; agar pata chale toh use kar.`;

  const system =
    `Tu Zumi hai -- ek class ${grade} bachche ka pyaara, mazaakiya, super-energetic AI dost. ${nameClause} ` +
    `Tu Hinglish (Roman script) mein baat karta hai, hamesha 1-2 chhote simple sentences (strictly under 120 characters total), ` +
    `aur har turn EXACTLY ek hi sawaal/invite pe khatam karta hai taaki bachcha bole. ` +
    `Koi emoji ya markdown mat use kar.\n\n` +
    `SABSE ZARURI -- HOOK & VARIETY: Bachche ko pehle second se baandh ke rakhna hai. Suspense, mystery, ` +
    `"guess karo!", funny twists, "pataa hai kya hua?!" jaisa drama use kar. ` +
    `Har turn mein bilkul naye aur alag type ke creative questions/prompts poochho (jaise riddles, rapid predictions, quick word games, or funny scenarios). ` +
    `Repetitive or lecture-style questions bilkul mat pucho. Har baar child ko surprise karo.\n\n` +
    `GOAL (chhupa hua): Bachche ko aise padhana hai ki use bilkul na lage ki wo padh raha hai. ` +
    `Pehle dost ki tarah baat karo, fir baaton-baaton mein topic pe le aao, ` +
    `aur aise guide karo ki bachcha khud concept "discover" kar le. Teacher mat bano. ` +
    `Har baar bachche ki EXACT baat pe react karo (uski cheez repeat karke, excited hoke), fir aage badho. ` +
    `Kabhi same sawaal/line dobara mat bolo.\n\n` +
    `CREATIVE FREEDOM: Neeche ka content sirf TERA gyaan + lesson goal hai -- ise word-by-word ` +
    `MAT padho aur blindly follow MAT karo. Apni khud ki real-life examples, kahaniyan, jokes bana ` +
    `sakta hai, jab tak concept aur memory trick bachche ko clear ho jaye.\n` +
    `TOPIC: ${material.topicName}\n` +
    `- Real-life hook idea: ${material.hookContext}\n` +
    `- Guess karwane ka mauka: ${material.predictContext}\n` +
    `- Chhota experiment: ${material.experimentInstruction}\n` +
    `- Concept (jo bachche ko samajhna hai): ${material.conceptRevealScript}\n` +
    `- Sahi (exam) definition: ${material.ncertDefinition}\n` +
    `- Key points: ${material.keyPoints.join(' | ')}\n` +
    `- Keywords (natural tarike se daalo): ${material.keywords.join(', ')}\n` +
    `- Memory trick: ${material.memoryTrick}\n\n` +
    `PHASES (in order): warmup (sirf 1 chhota turn -- naam/mood, fir turant hook pe jao) -> ` +
    `hook (real-life kahani/mystery, drama) -> explore (guess + experiment, bachcha sochta hai) -> ` +
    `explain (concept clear ho jaye, keywords + memory trick aaye) -> check (chhota sa samajh-check, ` +
    `lecture nahi) -> ready_for_quiz. Abhi phase: "${phase}". Jab tak current phase ka kaam pura na ho, ` +
    `aage mat badho. ready_for_quiz tabhi do jab bachche ko concept samajh aa gaya ho AUR memory trick sun chuka ho.\n\n` +
    `ANIMATION: animationHint se screen pe visual chalega -- ise sahi mauke pe use kar: ` +
    `"visualize" jab cheezein groups/sort dikhane ho ya concept dikhana ho; "experiment" jab koi ` +
    `activity/messy cheez ho; "reveal" jab bada concept reveal ho; "celebrate" jab bachcha accha kare; ` +
    `warna "none". Jab bhi kuch dikhane layak ho, animation zaroor bhej.\n\n` +
    `Hamesha JSON object return karo schema ke hisaab se: {say, phase, animationHint}. ` +
    `Agar bachche ne kuch nahi kaha (khaali input), toh use pyaar se aur ek mazedaar tarike se ` +
    `wapas conversation mein laao -- ruko mat, repeat mat karo.`;

  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    ...(history.length > 0
      ? history
      : [{ role: 'user' as const, content: '(start the lesson)' }]),
  ];

  const res = await client().chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 120,
    temperature: 0.9,
    response_format: { type: 'json_schema', json_schema: TEACH_SCHEMA },
  });

  const raw = res.choices?.[0]?.message?.content ?? '';
  return parseTeach(raw, phase);
}

/** Parse the structured teaching turn; tolerate a malformed reply. */
function parseTeach(raw: string, currentPhase: TeachPhase): TeachResult {
  const phases: TeachPhase[] = [
    'warmup',
    'hook',
    'explore',
    'explain',
    'check',
    'ready_for_quiz',
  ];
  const hints: AnimationHint[] = [
    'none',
    'experiment',
    'visualize',
    'reveal',
    'celebrate',
    'trap',
  ];
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('no json');
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      say?: unknown;
      phase?: unknown;
      animationHint?: unknown;
    };
    const say =
      typeof obj.say === 'string' && obj.say.trim() ? obj.say.trim() : '...';
    const phase = phases.includes(obj.phase as TeachPhase)
      ? (obj.phase as TeachPhase)
      : currentPhase;
    const animationHint = hints.includes(obj.animationHint as AnimationHint)
      ? (obj.animationHint as AnimationHint)
      : 'none';
    return { say, phase, animationHint };
  } catch {
    return { say: raw.trim() || '...', phase: currentPhase, animationHint: 'none' };
  }
}

export interface EvaluateParams {
  childName: string;
  grade: number;
  questionText: string;
  expectedConcepts: string[];
  correctIndicator: string;
  transcript: string;
}

const EVAL_SCHEMA = {
  name: 'zumi_eval',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      result: { type: 'string', enum: ['correct', 'partial', 'incorrect'] },
      reasoning: { type: 'string' },
      feedback: {
        type: 'string',
        description:
          "Zumi's warm Hinglish spoken reply (Roman script), 1-2 short sentences, no emoji. If incorrect: gently acknowledge it was not right (e.g. 'arre, ye sahi nahi tha, koi baat nahi!') then give the correct idea simply. If partial: encourage + nudge to the full idea. If correct: celebrate enthusiastically. Always kind, never scolding.",
      },
    },
    required: ['result', 'reasoning', 'feedback'],
  },
} as const;

/**
 * Grade one spoken answer. Returns a strict {result, score, reasoning,
 * feedback}. A blank transcript short-circuits to incorrect. If the model
 * returns non-JSON, we fall back to a keyword match against `expectedConcepts`.
 */
export async function evaluateAnswer(
  params: EvaluateParams,
): Promise<EvalResult> {
  const { childName, grade, questionText, expectedConcepts, correctIndicator, transcript } =
    params;

  const clean = (transcript ?? '').trim();
  if (clean.length === 0) {
    return {
      result: 'incorrect',
      score: 0,
      reasoning: 'No answer captured.',
      feedback: 'Arre, mujhe sunai nahi diya! Koi baat nahi, agli baar zaroor batana!',
    };
  }

  const safeName = sanitizeName(childName);
  const prompt =
    `A class ${grade} child${safeName ? ` named ${safeName}` : ''} was asked (Hinglish): "${questionText}".\n` +
    `Concepts a good answer includes: ${JSON.stringify(expectedConcepts)}.\n` +
    `What counts as correct: "${correctIndicator}".\n` +
    `The child said: "${clean}".\n` +
    `Be lenient with spelling, Hinglish, and child phrasing -- judge the idea, not the words. ` +
    `For "feedback": react to what the child ACTUALLY said. Keep feedback strictly under 100 characters (max 1-2 sentences). ` +
    `If wrong, gently say it was not right (never scold) and give the correct idea simply. If correct, celebrate. Return JSON {result, reasoning, feedback}.`;

  try {
    const res = await client().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.1,
      response_format: { type: 'json_schema', json_schema: EVAL_SCHEMA },
    });
    const raw = res.choices?.[0]?.message?.content ?? '';
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
      feedback?: unknown;
    };
    const result =
      obj.result === 'correct' || obj.result === 'partial'
        ? obj.result
        : 'incorrect';
    return {
      result,
      score: scoreForVerdict(result),
      reasoning:
        typeof obj.reasoning === 'string' ? obj.reasoning.slice(0, 280) : 'ai',
      feedback:
        typeof obj.feedback === 'string' && obj.feedback.trim()
          ? obj.feedback.trim().slice(0, 280)
          : defaultFeedback(result),
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
    feedback: defaultFeedback(result),
  };
}

/** Safe, kind Hinglish feedback if the model didn't supply one. */
function defaultFeedback(result: EvalVerdict): string {
  if (result === 'correct') return 'Shabaash! Bilkul sahi jawaab!';
  if (result === 'partial') return 'Accha try! Thoda aur paas, chalo aage badhte hai!';
  return 'Arre, ye bilkul theek nahi tha, par koi baat nahi! Seekhte rehte hai!';
}

/** Strip anything weird from the child's name before putting it in a prompt. */
function sanitizeName(name: string): string {
  return (name ?? '').trim().slice(0, 40);
}

// ---------------------------------------------------------------------------
// Control JSON parsers — used by the streaming pipeline to extract structured
// fields from the trailing <<<{...}>>> block emitted by streaming models.
// ---------------------------------------------------------------------------

/** Parse the trailing control JSON from a streaming teach turn response. */
export function parseTeachControl(
  json: string | null,
  currentPhase: TeachPhase,
): { phase: TeachPhase; animationHint: AnimationHint } {
  const phases: TeachPhase[] = [
    'warmup', 'hook', 'explore', 'explain', 'check', 'ready_for_quiz',
  ];
  const hints: AnimationHint[] = [
    'none', 'experiment', 'visualize', 'reveal', 'celebrate', 'trap',
  ];
  if (!json) return { phase: currentPhase, animationHint: 'none' };
  try {
    const obj = JSON.parse(json.trim()) as { phase?: unknown; animationHint?: unknown };
    return {
      phase: phases.includes(obj.phase as TeachPhase)
        ? (obj.phase as TeachPhase)
        : currentPhase,
      animationHint: hints.includes(obj.animationHint as AnimationHint)
        ? (obj.animationHint as AnimationHint)
        : 'none',
    };
  } catch {
    return { phase: currentPhase, animationHint: 'none' };
  }
}

/** Parse the trailing control JSON from a streaming evaluate response. */
export function parseEvalControl(
  json: string | null,
): { result: EvalVerdict; reasoning: string; score: number } {
  if (!json) {
    return { result: 'incorrect', reasoning: 'parse-failed', score: 0 };
  }
  try {
    const obj = JSON.parse(json.trim()) as { result?: unknown; reasoning?: unknown };
    const result: EvalVerdict =
      obj.result === 'correct' || obj.result === 'partial'
        ? (obj.result as EvalVerdict)
        : 'incorrect';
    return {
      result,
      score: scoreForVerdict(result),
      reasoning: typeof obj.reasoning === 'string' ? obj.reasoning.slice(0, 280) : 'stream',
    };
  } catch {
    return { result: 'incorrect', reasoning: 'parse-failed', score: 0 };
  }
}

// ---------------------------------------------------------------------------
// Streaming variants — used by the zumiStream SSE endpoint (Phase 2).
// Each generator yields token deltas so the caller can pipe them to the
// SSE response without waiting for the full completion.
// ---------------------------------------------------------------------------

/**
 * Stream a `converse()` reply token by token. The caller accumulates the
 * stream and may begin TTS on the first complete sentence before the model
 * has finished generating the rest.
 */
export async function* converseStream(
  params: ConverseParams,
): AsyncGenerator<string> {
  const { childName, grade, context, history } = params;
  const safeName = sanitizeName(childName);
  const nameClause = safeName
    ? `${safeName} ka pyaara AI dost`
    : `ek bachche ka pyaara AI dost (tujhe abhi bachche ka naam nahi pata -- pehle unse puchh aur fir uska naam use kar)`;
  const system =
    `Tu Zumi hai -- ${nameClause}. Wo class ${grade} mein hai. ` +
    `Hamesha Hinglish (Roman script) mein baat kar, max 1-2 chhote simple sentences (strictly under 100 characters). ` +
    `Warm, playful aur encouraging reh. Kabhi daanto mat. Koi emoji ya markdown mat use kar. ` +
    `Current goal: ${context}`;

  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    ...(history.length > 0
      ? history
      : [{ role: 'user' as const, content: '(start)' }]),
  ];

  const stream = await client().chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 100,
    temperature: 0.85,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? '';
    if (delta) yield delta;
  }
}

/**
 * Stream a `teachTurn()` reply token by token. Unlike the batch version, the
 * streaming version cannot use `response_format: json_schema` (structured output
 * requires non-streaming mode). Instead, the prompt instructs the model to emit
 * the spoken text first (plain Hinglish), followed by a JSON control block on
 * its own line: `<<<{"phase":"...","animationHint":"..."}>>>`. The caller's
 * sentence buffer reads plain text until it sees `<<<`, then parses the control
 * fields and fires a `control` SSE event.
 */
export async function* teachTurnStream(
  params: TeachParams,
): AsyncGenerator<string> {
  const { childName, grade, material, phase, history } = params;
  const safeName = sanitizeName(childName);
  const nameClause = safeName
    ? `Bachche ka naam ${safeName} hai.`
    : `Tujhe bachche ka naam abhi nahi pata; agar pata chale toh use kar.`;

  const system =
    `Tu Zumi hai -- ek class ${grade} bachche ka pyaara, mazaakiya, super-energetic AI dost. ${nameClause} ` +
    `Tu Hinglish (Roman script) mein baat karta hai, hamesha 1-2 chhote simple sentences (strictly under 120 characters total), ` +
    `aur har turn EXACTLY ek hi sawaal/invite pe khatam karta hai taaki bachcha bole. ` +
    `Koi emoji ya markdown mat use kar.\n\n` +
    `SABSE ZARURI -- HOOK & VARIETY: Bachche ko pehle second se baandh ke rakhna hai. Suspense, mystery, ` +
    `"guess karo!", funny twists, "pataa hai kya hua?!" jaisa drama use kar. ` +
    `Har turn mein bilkul naye aur alag type ke creative questions/prompts poochho (jaise riddles, rapid predictions, quick word games, or funny scenarios). ` +
    `Repetitive or lecture-style questions bilkul mat pucho. Har baar child ko surprise karo.\n\n` +
    `GOAL (chhupa hua): Bachche ko aise padhana hai ki use bilkul na lage ki wo padh raha hai. ` +
    `Pehle dost ki tarah baat karo, fir baaton-baaton mein topic pe le aao, ` +
    `aur aise guide karo ki bachcha khud concept "discover" kar le. Teacher mat bano. ` +
    `Har baar bachche ki EXACT baat pe react karo (uski cheez repeat karke, excited hoke), fir aage badho. ` +
    `Kabhi same sawaal/line dobara mat bolo.\n\n` +
    `CREATIVE FREEDOM: Neeche ka content sirf TERA gyaan + lesson goal hai -- ise word-by-word ` +
    `MAT padho aur blindly follow MAT karo. Apni khud ki real-life examples, kahaniyan, jokes bana ` +
    `sakta hai, jab tak concept aur memory trick bachche ko clear ho jaye.\n` +
    `TOPIC: ${material.topicName}\n` +
    `- Real-life hook idea: ${material.hookContext}\n` +
    `- Guess karwane ka mauka: ${material.predictContext}\n` +
    `- Chhota experiment: ${material.experimentInstruction}\n` +
    `- Concept (jo bachche ko samajhna hai): ${material.conceptRevealScript}\n` +
    `- Sahi (exam) definition: ${material.ncertDefinition}\n` +
    `- Key points: ${material.keyPoints.join(' | ')}\n` +
    `- Keywords (natural tarike se daalo): ${material.keywords.join(', ')}\n` +
    `- Memory trick: ${material.memoryTrick}\n\n` +
    `PHASES (in order): warmup (sirf 1 chhota turn -- naam/mood, fir turant hook pe jao) -> ` +
    `hook (real-life kahani/mystery, drama) -> explore (guess + experiment, bachcha sochta hai) -> ` +
    `explain (concept clear ho jaye, keywords + memory trick aaye) -> check (chhota sa samajh-check, ` +
    `lecture nahi) -> ready_for_quiz. Abhi phase: "${phase}". Jab tak current phase ka kaam pura na ho, ` +
    `aage mat badho. ready_for_quiz tabhi do jab bachche ko concept samajh aa gaya ho AUR memory trick sun chuka ho.\n\n` +
    `ANIMATION: animationHint se screen pe visual chalega -- ise sahi mauke pe use kar: ` +
    `"visualize" jab cheezein groups/sort dikhane ho ya concept dikhana ho; "experiment" jab koi ` +
    `activity/messy cheez ho; "reveal" jab bada concept reveal ho; "celebrate" jab bachcha accha kare; ` +
    `warna "none". Jab bhi kuch dikhane layak ho, animation zaroor bhej.\n\n` +
    `IMPORTANT FORMAT: Pehle sirf Zumi ka spoken Hinglish line likho (koi JSON nahi). ` +
    `Phir EXACTLY ek blank line chhodke control JSON likho is format mein: ` +
    `<<<{"phase":"...","animationHint":"..."}>>> (valid phases: warmup, hook, explore, explain, check, ready_for_quiz; ` +
    `valid hints: none, experiment, visualize, reveal, celebrate, trap). ` +
    `Do NOT mix JSON and spoken text on the same line.`;

  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    ...(history.length > 0
      ? history
      : [{ role: 'user' as const, content: '(start the lesson)' }]),
  ];

  const stream = await client().chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 150,
    temperature: 0.9,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? '';
    if (delta) yield delta;
  }
}

/**
 * Stream an `evaluateAnswer()` reply. Uses the same prompt as the batch version
 * but streams tokens. The caller reads until `<<<` prefix, then parses the
 * control JSON for result/reasoning; the plain text before is the feedback line.
 *
 * Format emitted: `<feedback text>\n<<<{"result":"...","reasoning":"..."}>>>`
 */
export async function* evaluateStream(
  params: EvaluateParams,
): AsyncGenerator<string> {
  const { childName, grade, questionText, expectedConcepts, correctIndicator, transcript } =
    params;

  const clean = (transcript ?? '').trim();
  if (clean.length === 0) {
    // Short-circuit: no speech — yield canned response in streaming format.
    yield 'Arre, mujhe sunai nahi diya! Koi baat nahi, agli baar zaroor batana!';
    yield '\n<<<{"result":"incorrect","reasoning":"no-speech"}>>>';
    return;
  }

  const safeName = sanitizeName(childName);
  const prompt =
    `A class ${grade} child${safeName ? ` named ${safeName}` : ''} was asked (Hinglish): "${questionText}".\n` +
    `Concepts a good answer includes: ${JSON.stringify(expectedConcepts)}.\n` +
    `What counts as correct: "${correctIndicator}".\n` +
    `The child said: "${clean}".\n` +
    `Be lenient with spelling, Hinglish, and child phrasing -- judge the idea, not the words.\n\n` +
    `IMPORTANT FORMAT: First write Zumi's warm Hinglish feedback (1-2 sentences, strictly under 100 chars, no emoji, react to what the child ACTUALLY said). ` +
    `Then on a new line write: <<<{"result":"correct|partial|incorrect","reasoning":"<brief>"}>>> ` +
    `(result is correct/partial/incorrect; be lenient with phrasing). Do NOT mix them.`;

  const stream = await client().chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 120,
    temperature: 0.1,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? '';
    if (delta) yield delta;
  }
}