/**
 * Zumi Agent DataChannel event types.
 *
 * Published by the Python LiveKit agent via room.local_participant.publish_data().
 * Consumed by the React Native client in zumiLiveKit.ts.
 *
 * Each event is a JSON object with a discriminated `type` field.
 * The RN client maps these 1:1 to the existing ZumiEvent interface
 * used by ZumiVoiceScreen.
 */

export interface ZumiCuePayload {
  type: 'experiment' | 'visualize' | 'reveal' | 'celebrate' | 'trap';
}

export type ZumiAgentEvent =
  | {type: 'state'; state: 'greeting' | 'teaching' | 'quiz' | 'closing' | 'done'}
  | {type: 'avatar'; avatar: 'idle' | 'talking' | 'listening' | 'thinking' | 'celebrating' | 'encouraging' | 'story_mode'}
  | {type: 'bubble'; text: string}
  | {type: 'cue'; cue: ZumiCuePayload | null}
  | {type: 'quiz'; current: number; total: number; score: number}
  | {type: 'listening'; on: boolean}
  | {type: 'done'; percentage: number; passed: boolean; score: number; maxScore: number}
  | {type: 'error'; message: string};
