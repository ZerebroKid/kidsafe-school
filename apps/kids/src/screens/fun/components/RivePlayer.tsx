/**
 * RivePlayer -- thin wrapper over `rive-react-native` for Zumi's interactive
 * story moments (the experiment, concept zoom, and sort-game).
 *
 * Rive (unlike Lottie) loads `.riv` files from the NATIVE bundle by name
 * (`resourceName`, no extension) or from a remote `url` -- there is no
 * `require('*.riv')`. Until a branded `.riv` is bundled, callers fall back to a
 * Lottie stand-in (see `ZumiCue`), so this renders nothing when given neither a
 * resource nor a url.
 *
 * Touch: `pointerEvents` is "auto" so a Rive state machine can be driven by the
 * child's taps/drags directly on the canvas (true "game" interactivity).
 */

import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import RiveRaw, {Alignment, Fit} from 'rive-react-native';

// rive-react-native's forwardRef component type isn't a clean JSX element type
// under our @types/react (duplicate-React-types issue, same as the Lottie
// wrapper). Cast to a permissive function-component shape so it composes.
const Rive = RiveRaw as unknown as React.ComponentType<{
  resourceName?: string;
  url?: string;
  stateMachineName?: string;
  artboardName?: string;
  autoplay?: boolean;
  fit?: Fit;
  alignment?: Alignment;
  style?: object;
}>;

interface RivePlayerProps {
  /** Bundled `.riv` resource name (android res/raw, iOS bundle) -- no extension. */
  resourceName?: string | null;
  /** Remote `.riv` URL (alternative to a bundled resource). */
  url?: string | null;
  /** State-machine to run (by convention `zumi` for our files). */
  stateMachineName?: string | null;
  /** Artboard to show, when a file has more than one. */
  artboardName?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function RivePlayer({
  resourceName,
  url,
  stateMachineName,
  artboardName,
  style,
}: RivePlayerProps) {
  if (!resourceName && !url) return null;
  return (
    <View style={[styles.wrap, style]}>
      <Rive
        resourceName={resourceName ?? undefined}
        url={url ?? undefined}
        stateMachineName={stateMachineName ?? undefined}
        artboardName={artboardName ?? undefined}
        autoplay
        fit={Fit.Contain}
        alignment={Alignment.Center}
        style={styles.rive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  rive: {width: '100%', height: '100%'},
});
