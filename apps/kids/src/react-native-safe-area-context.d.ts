/**
 * Patches TS2786 for SafeAreaView from react-native-safe-area-context.
 * Same root cause as react-native-svg: class component type mismatch
 * with @types/react >=18.2 stricter JSX element types.
 */
declare module 'react-native-safe-area-context' {
  import type {FC} from 'react';
  import type {ViewProps} from 'react-native';

  interface EdgeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  interface SafeAreaViewProps extends ViewProps {
    edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
    mode?: 'padding' | 'margin';
  }

  interface SafeAreaProviderProps extends ViewProps {
    initialMetrics?: Metrics | null;
  }

  interface Metrics {
    insets: EdgeInsets;
    frame: {x: number; y: number; width: number; height: number};
  }

  const SafeAreaView: FC<SafeAreaViewProps>;
  const SafeAreaProvider: FC<SafeAreaProviderProps>;

  function useSafeAreaInsets(): EdgeInsets;

  export {SafeAreaView, SafeAreaProvider, useSafeAreaInsets};
  export type {SafeAreaViewProps, SafeAreaProviderProps, EdgeInsets, Metrics};
}
