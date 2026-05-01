import type {Oem} from '../../../../modules/native';
import type {Step} from '../types';
import {genericSteps} from './generic';
import {samsungSteps} from './samsung';
import {xiaomiSteps} from './xiaomi';

/**
 * Map an OEM enum to its step array. Oppo / Vivo / Huawei share the generic flow in v1
 * (`OemSettings.getOem()` still detects them so future OEM-specific intents work, but we
 * don't have dedicated copy yet).
 */
export function stepsForOem(oem: Oem): Step[] {
  switch (oem) {
    case 'xiaomi':
      return xiaomiSteps;
    case 'samsung':
      return samsungSteps;
    default:
      return genericSteps;
  }
}
