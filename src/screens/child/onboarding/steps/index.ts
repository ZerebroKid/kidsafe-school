import type {Oem} from '../../../../modules/native';
import type {Step} from '../types';
import {genericSteps} from './generic';
import {oppoSteps} from './oppo';
import {samsungSteps} from './samsung';
import {xiaomiSteps} from './xiaomi';

/**
 * Map an OEM enum to its step array. Each OEM branch differs from generic in two ways:
 *
 *   - Wording on the instruction steps (where the toggle actually lives on that skin)
 *   - Extra steps for OEM-specific reliability gates (MIUI's Autostart + pop-up window,
 *     ColorOS's Allow-background-activity + Sleep-standby, etc.)
 *
 * Vivo shares the `oppo` flow because FuntouchOS / OriginOS map their own component names
 * onto the same three concepts and `OemSettingsModule.kt` already routes them to the right
 * intents — see `openAutostartSettings` and `openBatteryUnrestricted` `when (detectOem())`
 * branches.
 *
 * Huawei still falls through to generic for now. (Modern Huawei devices have no GMS so the
 * underlying location pipeline relies on the `LocationManager` fallback added in
 * `LocationWriter.kt` — the onboarding copy doesn't need a dedicated branch yet.)
 */
export function stepsForOem(oem: Oem): Step[] {
  switch (oem) {
    case 'xiaomi':
      return xiaomiSteps;
    case 'samsung':
      return samsungSteps;
    case 'oppo':
    case 'vivo':
      return oppoSteps;
    default:
      return genericSteps;
  }
}
