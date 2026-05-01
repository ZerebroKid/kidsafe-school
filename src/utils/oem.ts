import {Platform} from 'react-native';

import {OemSettings, type Oem} from '../modules/native';

/**
 * Resolves the device OEM. Prefers the native module (which inspects Build.MANUFACTURER and
 * Build.BRAND) but falls back to React Native's Platform.constants if the native module isn't
 * registered yet — this happens during a hot reload when JS reloads before the native bridge
 * picks up the new module list.
 */
export async function detectOem(): Promise<Oem> {
  try {
    return await OemSettings.getOem();
  } catch {
    return detectOemFromPlatform();
  }
}

/** Synchronous fallback. Useful for snapshot defaults before the async detect resolves. */
export function detectOemFromPlatform(): Oem {
  if (Platform.OS !== 'android') {return 'generic';}
  const constants = Platform.constants as
    | {Manufacturer?: string; Brand?: string}
    | undefined;
  const mfr = (constants?.Manufacturer ?? '').toLowerCase();
  const brand = (constants?.Brand ?? '').toLowerCase();

  if (
    mfr.includes('xiaomi') ||
    brand.includes('xiaomi') ||
    brand.includes('redmi') ||
    brand.includes('poco')
  ) {
    return 'xiaomi';
  }
  if (mfr.includes('samsung') || brand.includes('samsung')) {return 'samsung';}
  if (mfr.includes('oppo') || brand.includes('oppo') || brand.includes('realme')) {
    return 'oppo';
  }
  if (mfr.includes('vivo') || brand.includes('vivo') || brand.includes('iqoo')) {
    return 'vivo';
  }
  if (mfr.includes('huawei') || brand.includes('huawei') || brand.includes('honor')) {
    return 'huawei';
  }
  return 'generic';
}

/**
 * Friendly label for showing in the UI ("Xiaomi", "Samsung", etc.). The wizard uses this in copy
 * like "Grant Xiaomi-specific permissions".
 */
export function oemLabel(oem: Oem): string {
  switch (oem) {
    case 'xiaomi':
      return 'Xiaomi';
    case 'samsung':
      return 'Samsung';
    case 'oppo':
      return 'Oppo';
    case 'vivo':
      return 'Vivo';
    case 'huawei':
      return 'Huawei';
    default:
      return 'your phone';
  }
}
