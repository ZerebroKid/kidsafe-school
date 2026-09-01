/**
 * Patches TS2786 "cannot be used as a JSX component" for react-native-svg.
 *
 * Root cause: react-native-svg exports class components whose `Component`
 * base type lacks the `refs` property required by @types/react >=18.2.
 * Re-declaring the module with FC types resolves the mismatch.
 *
 * No top-level imports from 'react-native-svg' — that would turn this
 * into an augmentation instead of a replacement declaration.
 */
declare module 'react-native-svg' {
  import type {FC} from 'react';

  interface SvgProps {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    fill?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface PathProps {
    d?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface CircleProps {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface RectProps {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    rx?: number | string;
    ry?: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface LineProps {
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
    stroke?: string;
    strokeWidth?: number | string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface GProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface TextProps {
    x?: number | string;
    y?: number | string;
    fill?: string;
    fontSize?: number | string;
    textAnchor?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface DefsProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface LinearGradientProps {
    id?: string;
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
    gradientUnits?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface RadialGradientProps {
    id?: string;
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    fx?: number | string;
    fy?: number | string;
    gradientUnits?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  interface StopProps {
    offset?: number | string;
    stopColor?: string;
    stopOpacity?: number | string;
    [key: string]: any;
  }

  const Svg: FC<SvgProps>;
  const Path: FC<PathProps>;
  const Circle: FC<CircleProps>;
  const Rect: FC<RectProps>;
  const Line: FC<LineProps>;
  const G: FC<GProps>;
  const Text: FC<TextProps>;
  const Defs: FC<DefsProps>;
  const LinearGradient: FC<LinearGradientProps>;
  const RadialGradient: FC<RadialGradientProps>;
  const Stop: FC<StopProps>;

  export default Svg;
  export {
    Svg,
    Path,
    Circle,
    Rect,
    Line,
    G,
    Text,
    Defs,
    LinearGradient,
    RadialGradient,
    Stop,
  };
  export type {
    SvgProps,
    PathProps,
    CircleProps,
    RectProps,
    LineProps,
    GProps,
    TextProps,
    DefsProps,
    LinearGradientProps,
    RadialGradientProps,
    StopProps,
  };
}
