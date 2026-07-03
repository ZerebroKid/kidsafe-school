/**
 * Zumi SSE Streaming Endpoint — Phase 2 of the real-time voice pipeline.
 *
 * Unlike the existing `onCall` callables, this `onRequest` function uses
 * Server-Sent Events (SSE) to stream audio chunks to the client as soon as
 * each sentence is synthesized. The client receives audio for sentence 1
 * while sentences 2-N are still being generated and synthesized in parallel,
 * reducing time-to-first-audio (TTFA) from ~2.5 s (callable) to ~500–800 ms.
 *
 * Auth: Firebase ID token in the `Authorization: Bearer <token>` header (same
 * key the Firebase SDK uses, verified here via firebase-admin). This is
 * necessary because SSE uses a plain `fetch`, not the Firebase Functions
 * callable envelope which handles auth for `onCall`.
 *
 * Supported modes (POST body `mode` field):
 *   - `converse`  — greeting / closing chat turn
 *   - `teach`     — one adaptive teaching turn
 *   - `evaluate`  — grade a spoken quiz answer
 *
 * SSE event schema (see zumiStreamPipeline.ts for full docs):
 *   event: text_delta   data: {"text":"..."}
 *   event: audio_chunk  data: {"seq":0,"base64":"...","contentType":"audio/mpeg"}
 *   event: control      data: {"phase":"hook","animationHint":"sparkle"}
 *   event: perf         data: {"llmFirstTokenMs":320,"ttsFirstChunkMs":180}
 *   event: done         data: {}
 *   event: error        data: {"message":"..."}
 */

import { onRequest } from 'firebase-functions/v2/https';

import { auth, db } from '../lib/admin';
import { resolveVoiceContext } from '../lib/zumiSession';
import {
  streamConverse,
  streamTeachTurn,
  streamEvaluate,
} from '../lib/zumiStreamPipeline';
import type { ConverseParams, TeachParams, EvaluateParams, TeachPhase } from '../lib/zumiAi';

// ---------------------------------------------------------------------------
// Auth helpers for onRequest (can't use the onCall requireAuth/requireRole)
// ---------------------------------------------------------------------------

async function verifyBearerToken(
  authHeader: string | undefined,
): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing auth token'), { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length);
  const decoded = await auth().verifyIdToken(token);
  return decoded.uid;
}

async function requireChildRole(uid: string): Promise<void> {
  const snap = await db().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw Object.assign(new Error('User profile missing'), { status: 403 });
  }
  const data = snap.data() ?? {};
  const roles: unknown = data.roles;
  const legacy: unknown = data.role;
  const normalised: string[] = Array.isArray(roles)
    ? roles.filter((r): r is string => typeof r === 'string')
    : typeof legacy === 'string'
      ? [legacy]
      : [];
  if (!normalised.includes('child')) {
    throw Object.assign(new Error('Requires child role'), { status: 403 });
  }
}

// ---------------------------------------------------------------------------
// Teaching-phase validation
// ---------------------------------------------------------------------------

const VALID_PHASES: TeachPhase[] = [
  'warmup', 'hook', 'explore', 'explain', 'check', 'ready_for_quiz',
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const zumiStream = onRequest(
  {
    region: 'asia-south1',
    // Keep one instance warm at all times — cold starts add 1–3 s and destroy
    // the latency budget we are trying to hit.
    minInstances: 1,
    // Streaming responses can take up to ~30 s for long TTS synthesis chains.
    timeoutSeconds: 60,
    // Allow the kids app origin. In production, tighten to the exact app
    // bundle origin or remove CORS if the client uses the native fetch.
    cors: true,
  },
  async (req, res) => {
    // Only POST is valid; SSE response is set up immediately after auth.
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // ---- Authenticate -------------------------------------------------------
    let uid: string;
    try {
      uid = await verifyBearerToken(req.headers.authorization);
      await requireChildRole(uid);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 401).json({ error: e.message ?? 'Unauthorized' });
      return;
    }

    // ---- Parse body ---------------------------------------------------------
    const body = req.body as {
      mode?: string;
      assignmentId?: string;
      stage?: string;
      phase?: string;
      history?: Array<{ role: string; content: string }>;
      scorePercent?: number;
      transcript?: string;
      questionId?: string;
    };

    const mode = body?.mode;
    const assignmentId = body?.assignmentId;
    if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
      res.status(400).json({ error: 'assignmentId is required' });
      return;
    }

    // ---- Resolve context (uses the same 10-min TTL cache as callables) ------
    let ctx: Awaited<ReturnType<typeof resolveVoiceContext>>;
    try {
      ctx = await resolveVoiceContext(uid, assignmentId);
    } catch (err) {
      const e = err as { message?: string; httpErrorCode?: { status?: number } };
      res.status(e.httpErrorCode?.status ?? 500).json({ error: e.message ?? 'Context error' });
      return;
    }

    // ---- Set up SSE response ------------------------------------------------
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
    res.flushHeaders();

    console.log('[zumiStream] connected', { uid, mode, assignmentId });

    // ---- Route to the correct pipeline mode ---------------------------------
    const vs = ctx.voiceStory;
    const safeHistory = Array.isArray(body.history)
      ? body.history
          .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .slice(-10)
          .map(t => ({ role: t.role as 'user' | 'assistant', content: t.content.slice(0, 500) }))
      : [];

    try {
      switch (mode) {
        case 'converse': {
          const stage = body.stage === 'closing' ? 'closing' : 'greeting';
          const pct =
            typeof body.scorePercent === 'number' && Number.isFinite(body.scorePercent)
              ? Math.max(0, Math.min(100, body.scorePercent))
              : 0;

          const contextStr = stage === 'greeting'
            ? `Greet ${ctx.childName || 'the child'} warmly by name and start a genuine get-to-know-you chat. Ask their name and how their day is going. Do NOT mention any lesson yet. Keep it 2-3 short playful Hinglish sentences, end with one simple question.`
            : (() => {
                const c = pct >= 75 ? vs.closingHighScoreContext : pct >= 50 ? vs.closingMidScoreContext : vs.closingLowScoreContext;
                return `Wrap up the session warmly. ${c}`;
              })();

          const converseParams: ConverseParams = {
            childName: ctx.childName,
            grade: ctx.grade,
            context: contextStr,
            history: safeHistory,
          };
          await streamConverse(res, converseParams);
          break;
        }

        case 'teach': {
          const phase = VALID_PHASES.includes(body.phase as TeachPhase)
            ? (body.phase as TeachPhase)
            : 'warmup';

          const teachParams: TeachParams = {
            childName: ctx.childName,
            grade: ctx.grade,
            phase,
            history: safeHistory,
            material: {
              topicName: ctx.topicName,
              hookContext: vs.hookContext,
              predictContext: vs.predictContext,
              experimentInstruction: vs.experimentInstruction,
              conceptRevealScript: vs.conceptRevealScript,
              ncertDefinition: vs.ncertDefinition,
              keyPoints: Array.isArray(vs.keyPoints) ? vs.keyPoints : [],
              keywords: Array.isArray(vs.keywords) ? vs.keywords : [],
              memoryTrick: vs.memoryTrick,
            },
          };
          await streamTeachTurn(res, teachParams);
          break;
        }

        case 'evaluate': {
          const questionId = body.questionId;
          const transcript = typeof body.transcript === 'string' ? body.transcript : '';
          const question = vs.voiceQuiz.find(q => q.questionId === questionId);

          if (!question) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'Question not found' })}\n\n`);
            res.end();
            return;
          }

          const evalParams: EvaluateParams = {
            childName: ctx.childName,
            grade: ctx.grade,
            questionText: question.questionText,
            expectedConcepts: Array.isArray(question.expectedConcepts) ? question.expectedConcepts : [],
            correctIndicator: question.correctIndicator ?? '',
            transcript: transcript.slice(0, 1000),
          };
          await streamEvaluate(res, evalParams);
          break;
        }

        default:
          res.write(`event: error\ndata: ${JSON.stringify({ message: `Unknown mode: ${mode}` })}\n\n`);
      }
    } catch (err) {
      console.error('[zumiStream] unhandled pipeline error', err);
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Internal error' })}\n\n`);
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);
