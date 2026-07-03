/**
 * mintBrowserToken.mjs — mint a LiveKit token for browser-based Zumi testing.
 *
 * Mirrors the production `zumiLiveKitToken` callable (roomConfig + agent
 * dispatch + lesson metadata) but WITHOUT Firebase Auth, so you can join the
 * exact same agent pipeline from a real-mic browser client (e.g. the LiveKit
 * Agents Playground) when a physical device / working emulator mic isn't
 * available.
 *
 * Usage (from repo root):
 *   node apps/functions/scripts/mintBrowserToken.mjs [assignmentId] [childName]
 *
 * Defaults use the assignment seen in the dev logs (Hari / classifying things).
 * Then open https://agents-playground.livekit.io , choose "Manual" connection,
 * and paste the printed WS URL + token.
 */

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {AccessToken} from 'livekit-server-sdk';
import {RoomAgentDispatch, RoomConfiguration} from '@livekit/protocol';

const AGENT_NAME = 'zumi-voice-agent';
const here = dirname(fileURLToPath(import.meta.url));

// Load LiveKit creds from the functions env file so nothing is hard-coded.
const envPath = join(here, '..', '.env.kidsafe-e5eac');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const API_KEY = env.LIVEKIT_API_KEY;
const API_SECRET = env.LIVEKIT_API_SECRET;
let wsUrl = env.LIVEKIT_URL || '';
if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');

if (!API_KEY || !API_SECRET || !wsUrl) {
  console.error('Missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in .env.kidsafe-e5eac');
  process.exit(1);
}

const assignmentId =
  process.argv[2] || 'hUzy1q63Vbz3NjuCYdvs_classifying_things_2026-07-02';
const childName = process.argv[3] || 'Hari';
const childUid = 'browser-test-user';
const roomName = `zumi_${assignmentId}_${childUid}_${Date.now()}`;

// Identical shape to the callable's roomMetadata so the agent's
// load_voice_context() finds the lesson in Firestore.
const roomMetadata = JSON.stringify({
  assignmentId,
  childUid,
  childName,
  grade: 3,
  topicName: 'Classifying Things',
});

const at = new AccessToken(API_KEY, API_SECRET, {
  identity: childUid,
  name: childName,
  metadata: JSON.stringify({role: 'child'}),
});

at.addGrant({
  roomJoin: true,
  room: roomName,
  roomCreate: true,
  canPublish: true,
  canSubscribe: true,
});

at.roomConfig = new RoomConfiguration({
  agents: [new RoomAgentDispatch({agentName: AGENT_NAME, metadata: roomMetadata})],
  metadata: roomMetadata,
});

const token = await at.toJwt();

console.log('\n================ Zumi browser test ================');
console.log('WS URL :', wsUrl);
console.log('Room   :', roomName);
console.log('Child  :', childName, `(assignment=${assignmentId})`);
console.log('\n----- TOKEN (copy everything on the next line) -----');
console.log(token);
console.log('\nHow to test:');
console.log('  1. Make sure the agent worker is running (python agent.py dev).');
console.log('  2. Open https://agents-playground.livekit.io');
console.log('  3. Click the connection dropdown -> "Manual".');
console.log('  4. Paste the WS URL and TOKEN above, then Connect.');
console.log('  5. Allow the mic; speak — Zumi replies with real audio.');
console.log('===================================================\n');
