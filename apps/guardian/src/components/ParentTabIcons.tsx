import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

interface TabIconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

/** Bottom-tab icon: linked children / family. */
export function ChildrenTabIcon({
  color,
  size = 24,
  focused = false,
}: TabIconProps) {
  const stroke = focused ? 2.2 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={stroke} />
      <Circle cx="16" cy="8" r="2.5" stroke={color} strokeWidth={stroke} />
      <Path
        d="M4 20c0-3 2.5-5 5-5s5 2 5 5"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <Path
        d="M13 19.5c0-2 1.5-3.5 3-3.5"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Bottom-tab icon: settings gear. */
export function SettingsTabIcon({
  color,
  size = 24,
  focused = false,
}: TabIconProps) {
  const stroke = focused ? 2.2 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth={stroke} />
      <Path
        d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}
